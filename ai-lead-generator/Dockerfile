# ── Build Frontend ──
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Backend ──
FROM python:3.11-slim
WORKDIR /app

# Install backend deps
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy built frontend to static serving
COPY --from=frontend-build /app/frontend/dist ./static

# Environment
ENV PORT=8000
ENV APP_ENV=production
ENV DATABASE_URL=sqlite:///./data/leadgen.db

RUN mkdir -p /app/data

EXPOSE 8000

CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
