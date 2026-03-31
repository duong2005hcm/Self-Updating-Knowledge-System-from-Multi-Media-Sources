from backend.app.rag.agent.planner import plan_step
from backend.app.rag.agent.response_generator import generate_professional_answer
from backend.app.rag.retrieval.retrieval import multi_query_retrieve

MAX_STEPS = 2


def build_observation(results):

    if not results:
        return "No relevant information found."

    obs = []

    for r in results[:2]:
        text = r.get("text", "")[:200]
        score = round(r.get("score", 0), 2)

        obs.append(f"(score={score}) {text}")

    return "\n".join(obs)


def agent_loop(question, history):

    all_contexts = []
    observation = None

    for step in range(MAX_STEPS):

        plan = plan_step(question, observation)

        action = plan.get("action")
        action_input = plan.get("action_input")

        print(f"[STEP {step}] {action}")

        if action == "answer_final":
            break

        results = multi_query_retrieve(
            question=action_input,
            top_k=6
        )

        # fallback nếu fail
        if not results:
            results = multi_query_retrieve(
                question=action_input + " detailed explanation",
                top_k=6
            )

        if results:
            all_contexts.extend(results)

            observation = build_observation(results)

            # early stop
            if results[0]["score"] > 0.9:
                break
        else:
            observation = "No relevant information found."

    return generate_professional_answer(
        question=question,
        contexts=all_contexts[:6],
        history=history
    )