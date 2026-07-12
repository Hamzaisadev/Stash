FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Bundle app source
COPY . .

# Expose port 7860 (Required by Hugging Face Spaces)
EXPOSE 7860

# Run the backend
CMD [ "npm", "start" ]
