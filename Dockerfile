FROM node:25-slim

# Install system dependencies for PDF operations
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    ghostscript \
    graphicsmagick \
    default-jre \
    fontconfig \
    fonts-liberation \
    fonts-dejavu-core \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

#Install nestjs cli
RUN npm install -g @nestjs/cli

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create temp directory
RUN mkdir -p temp && chmod 777 temp

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["npm", "run", "start:prod"]

