# Use Python 3.12 slim image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv package manager
RUN pip install uv

# Copy pyproject.toml and uv.lock for better dependency management
COPY pyproject.toml uv.lock ./

# Install Python dependencies using uv (creates and uses virtual environment)
RUN uv sync --frozen

# Set the virtual environment path
ENV VIRTUAL_ENV=/app/.venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Copy the entire application
COPY . .

# Create directory for transcripts
RUN mkdir -p storage

# Expose ports for API and WebRTC bot
EXPOSE 8001 7860

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Run the API server
CMD ["python", "-m", "uvicorn", "interview_api:app", "--host", "0.0.0.0", "--port", "8001"]