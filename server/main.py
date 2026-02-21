import os
import json
import stripe
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from supabase import create_client
from file_processor import process_file
from cost_estimator import estimate_cost
from analyzer import run_analysis, init_client

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client in analyzer
init_client(os.getenv("OPENAI_API_KEY"))

# Stripe configuration
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Supabase client with service key for server-side operations
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY"),
)


@app.get("/")
async def health_check():
    return {"status": "ok", "service": "pneuma-api"}


@app.post("/chat")
async def chat(message: str = Form(...)):
    from openai import OpenAI
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": message}],
        max_tokens=500,
    )
    return {"response": response.choices[0].message.content}


@app.post("/analyze/estimate")
async def analyze_estimate(
    file: UploadFile = File(...),
    num_calls: int = Form(...),
):
    try:
        file_data = await process_file(file)
        prompt_tokens = 200  # approximate system prompt tokens
        input_tokens = file_data["estimated_tokens"] + prompt_tokens
        cost = estimate_cost(input_tokens, num_calls)
        return cost
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})


@app.post("/analyze/stream")
async def analyze_stream(
    file: UploadFile = File(...),
    prompt: str = Form(...),
    num_calls: int = Form(...),
    user_id: str = Form(...),
):
    try:
        # Check and deduct balance
        result = supabase.table("balance").select("balance").eq("id", user_id).single().execute()
        if not result.data:
            return JSONResponse(status_code=400, content={"error": "User balance not found"})

        current_balance = float(result.data["balance"])

        # Quick estimate for balance check
        file_data = await process_file(file)
        prompt_tokens = 200
        input_tokens = file_data["estimated_tokens"] + prompt_tokens
        cost = estimate_cost(input_tokens, num_calls)

        if current_balance < cost["total_cost"]:
            return JSONResponse(status_code=400, content={"error": "Insufficient balance"})

        # Deduct balance
        new_balance = round(current_balance - cost["total_cost"], 4)
        supabase.table("balance").update({"balance": new_balance}).eq("id", user_id).execute()

        async def event_generator():
            async for event in run_analysis(prompt, file_data, num_calls):
                yield event

        return EventSourceResponse(event_generator())
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})


@app.post("/create-checkout")
async def create_checkout(request: Request):
    data = await request.json()
    user_id = data.get("user_id")
    amount = data.get("amount", 500)  # cents

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": "Pneuma Analysis Credits"},
                    "unit_amount": amount,
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=os.getenv("FRONTEND_ORIGIN", "http://localhost:5174") + "?payment=success",
            cancel_url=os.getenv("FRONTEND_ORIGIN", "http://localhost:5174") + "?payment=cancel",
            metadata={"user_id": user_id},
        )
        return {"url": session.url}
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})


@app.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        print(f"[Stripe Webhook] Invalid payload: {e}")
        return JSONResponse(status_code=400, content={"error": "Invalid payload"})
    except stripe.error.SignatureVerificationError as e:
        print(f"[Stripe Webhook] Signature verification failed: {e}")
        return JSONResponse(status_code=400, content={"error": "Invalid signature"})

    print(f"[Stripe Webhook] Received event: {event['type']}")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")
        amount_total = session.get("amount_total", 0)  # in cents
        credit = round(amount_total / 100, 4)  # convert to dollars

        print(f"[Stripe Webhook] user_id={user_id}, credit=${credit}")

        if user_id:
            try:
                # Get current balance
                result = supabase.table("balance").select("balance").eq("id", user_id).execute()
                if result.data:
                    current = float(result.data[0]["balance"])
                    new_balance = round(current + credit, 4)
                    supabase.table("balance").update({"balance": new_balance}).eq("id", user_id).execute()
                    print(f"[Stripe Webhook] Updated balance: {current} -> {new_balance}")
                else:
                    supabase.table("balance").insert({"id": user_id, "balance": credit}).execute()
                    print(f"[Stripe Webhook] Created balance row: {credit}")
            except Exception as e:
                print(f"[Stripe Webhook] Supabase error: {e}")
                return JSONResponse(status_code=500, content={"error": "Failed to update balance"})

    return {"status": "ok"}


@app.get("/balance/{user_id}")
async def get_balance(user_id: str):
    """Direct balance endpoint so frontend can poll after payment."""
    try:
        result = supabase.table("balance").select("balance").eq("id", user_id).execute()
        if result.data:
            return {"balance": float(result.data[0]["balance"])}
        return {"balance": 0.0}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
