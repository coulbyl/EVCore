import sys, warnings, joblib, sklearn, xgboost
print("sklearn", sklearn.__version__, "xgboost", xgboost.__version__)
for p in sys.argv[1:]:
    m = joblib.load(p)
    print(p.split("/")[-1], type(m).__name__)
    for name, step in getattr(m, "steps", []):
        print("  step:", name, type(step).__name__)
    if hasattr(m, "feature_names_in_"): print("  features:", list(m.feature_names_in_))
