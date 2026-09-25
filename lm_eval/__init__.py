try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from .evaluator import evaluate, simple_evaluate
except ModuleNotFoundError:
    evaluate = None
    simple_evaluate = None
