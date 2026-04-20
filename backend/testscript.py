from explainer import explain_code_hf

chunk = "def add(a,b): return a+b"
explanation = explain_code_hf(chunk, "Explain this function to a beginner")
print(explanation)