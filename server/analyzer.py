import asyncio
import json
import random
from openai import AsyncOpenAI
from sample_people import all_people

client = None


def init_client(api_key: str):
    global client
    client = AsyncOpenAI(api_key=api_key)


def build_messages(persona: str, prompt: str, file_data: dict) -> list:
    system_msg = (
        f"You are simulating the perspective of the following person:\n\n"
        f"{persona}\n\n"
        f"Answer the following yes/no question based on how this person would "
        f"likely respond given their background, values, and worldview. "
        f"You MUST answer with ONLY 'Yes' or 'No'. Nothing else. "
        f"No explanation, no reasoning, no extra words. Just 'Yes' or 'No'."
    )

    messages = [{"role": "system", "content": system_msg}]

    reminder = "Remember: you MUST answer 'Yes' or 'No' only. No other answer is acceptable."

    if file_data["type"] == "image":
        messages.append({
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": file_data["data_url"]}},
                {"type": "text", "text": f"{prompt}\n\n{reminder}"},
            ],
        })
    else:
        messages.append({
            "role": "user",
            "content": f"Context from uploaded file:\n\n{file_data['content']}\n\nQuestion: {prompt}\n\n{reminder}",
        })

    return messages


async def parse_answer(text: str) -> str:
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a classifier. Given a response, determine if it means 'yes' or 'no'. Reply with ONLY the word 'yes' or 'no'."},
            {"role": "user", "content": text},
        ],
        max_tokens=3,
        temperature=0,
    )
    result = response.choices[0].message.content.strip().lower()
    if result.startswith("yes"):
        return "yes"
    return "no"


async def run_single_call(persona: str, prompt: str, file_data: dict, index: int) -> dict:
    try:
        messages = build_messages(persona, prompt, file_data)
        response = await client.chat.completions.create(
            model="gpt-5.2",
            messages=messages,
            max_tokens=3,
            temperature=1,
        )
        text = response.choices[0].message.content
        answer = await parse_answer(text)
        print(f"[Agent {index}] Persona: {persona.split(',')[0]} | Raw: '{text}' | Classified: {answer}")
        return {
            "index": index,
            "persona": persona,
            "answer": answer,
            "explanation": text,
            "status": "success",
        }
    except Exception as e:
        print(f"[Agent {index}] ERROR: {e}")
        return {
            "index": index,
            "persona": persona,
            "answer": "error",
            "explanation": str(e),
            "status": "error",
        }


async def run_analysis(prompt: str, file_data: dict, num_calls: int):
    personas = random.sample(all_people, min(num_calls, len(all_people)))
    if num_calls > len(all_people):
        extras = random.choices(all_people, k=num_calls - len(all_people))
        personas.extend(extras)

    # Yield start event
    yield {
        "event": "start",
        "data": json.dumps({"total": num_calls}),
    }

    # Run all calls in parallel
    tasks = [
        run_single_call(personas[i], prompt, file_data, i)
        for i in range(num_calls)
    ]

    for coro in asyncio.as_completed(tasks):
        result = await coro
        yield {
            "event": "result",
            "data": json.dumps(result),
        }

    # Yield complete event
    yield {
        "event": "complete",
        "data": json.dumps({"status": "done"}),
    }
