# Use Bun as the base image
FROM node:16-alpine


# Create app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --only=production

# Bundle app source
COPY . .

# Create a directory for data persistence
RUN mkdir -p data/quizzes

# Define environment variable
ENV NODE_ENV production

# Run the app with Bun
CMD ["bun", "index.js"]