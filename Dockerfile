# Use Bun as the base image
FROM oven/bun:1.0.18

# Create app directory
WORKDIR /usr/src/app

# Copy package.json
COPY package.json ./

# Install dependencies with Bun
RUN bun install --production

# Bundle app source
COPY . .

# Create a directory for data persistence
RUN mkdir -p data/quizzes

# Define environment variable
ENV NODE_ENV production

# Run the app with Bun
CMD ["bun", "index.js"]