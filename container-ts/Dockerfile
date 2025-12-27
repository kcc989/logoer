FROM node:20-slim

# Install system dependencies for canvas (used by paper.js for Node)
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Copy fonts
COPY fonts/ ./fonts/

# Build TypeScript
RUN npm run build

# Expose the server port
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
