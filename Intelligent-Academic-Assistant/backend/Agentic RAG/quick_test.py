# quick_test.py
from agentic_rag import AgenticRAG
agent = AgenticRAG()
q = input("Enter your academic question: ")
resp = agent.handle_query(q)
if resp['action'] == 'clarify':
    print("Clarify:", resp['prompt'])
else:
    print("Answer:\n", resp['answer'])
    print("Saved file:", resp['file'])
