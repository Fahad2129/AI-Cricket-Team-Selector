import subprocess
import sys
import os

def main():
    root = os.path.dirname(os.path.abspath(__file__))
    venv_python = os.path.join(root, ".venv", "Scripts", "python.exe")
    
    print("Starting PSL AI...")
    print("API Server: http://localhost:8080")
    print("Frontend:   http://localhost:5173")
    print("-" * 40)

    api = subprocess.Popen(
        [venv_python, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--reload"],
        cwd=os.path.join(root, "artifacts", "api-server"),
    )

    frontend = subprocess.Popen(
        ["pnpm", "run", "dev"],
        cwd=os.path.join(root, "artifacts", "psl-ai"),
        shell=True,
    )

    try:
        api.wait()
        frontend.wait()
    except KeyboardInterrupt:
        print("\nShutting down...")
        api.terminate()
        frontend.terminate()

if __name__ == "__main__":
    main()