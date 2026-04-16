# -----------------------------------
# Stage 1: Build the Vite React App
# -----------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy package files and install frontend dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source and build (includes VitePWA generation)
COPY frontend/ ./
RUN npm run build

# -----------------------------------
# Stage 2: Build the Backend Server
# -----------------------------------
FROM node:20-alpine AS backend-server
WORKDIR /app/backend

# Copy package files and install backend dependencies
COPY backend/package*.json ./
RUN npm install --production

# Copy backend source
COPY backend/ ./

# Copy built frontend assets to the backend's public directory
COPY --from=frontend-builder /app/frontend/dist ./public

# Expose the API port
EXPOSE 3001

# Start the Express server
CMD ["node", "server.js"]
