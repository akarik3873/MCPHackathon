# GPT-4o pricing
INPUT_COST_PER_TOKEN = 2.50 / 1_000_000   # $2.50 per 1M input tokens
OUTPUT_COST_PER_TOKEN = 10.00 / 1_000_000  # $10.00 per 1M output tokens
ESTIMATED_OUTPUT_TOKENS = 200  # approximate output per call


def estimate_cost(input_tokens: int, num_calls: int) -> dict:
    input_cost_per_call = input_tokens * INPUT_COST_PER_TOKEN
    output_cost_per_call = ESTIMATED_OUTPUT_TOKENS * OUTPUT_COST_PER_TOKEN
    cost_per_call = input_cost_per_call + output_cost_per_call
    total_cost = cost_per_call * num_calls

    return {
        "input_tokens": input_tokens,
        "num_calls": num_calls,
        "cost_per_call": round(cost_per_call, 6),
        "total_cost": round(total_cost, 4),
        "display_cost": format_cost(total_cost),
    }


def format_cost(cost: float) -> str:
    if cost < 0.01:
        return f"${cost:.4f}"
    return f"${cost:.2f}"
