# Use Node.js 20 LTS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy relayer files
COPY relayer.js ./
COPY availHelper.js ./

# Copy contracts directory (for ABIs)
COPY contracts/ ./contracts/

# Set environment to production
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Relayer running')" || exit 1

# Run relayer
CMD ["node", "relayer.js"]