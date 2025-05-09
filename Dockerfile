# Use Node.js as the base image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package.json first
COPY package.json ./

# Install dependencies - using npm install instead of npm ci
# This will work with or without a package-lock.json file
RUN npm install --production --no-audit

# Bundle app source
COPY . .

# Create a directory for data persistence
RUN mkdir -p data/quizzes

# Your app binds to port 3000 if you're using a web server component
# EXPOSE 3000

# Define environment variable
ENV NODE_ENV production

# Run the app
CMD ["node", "index.js"]