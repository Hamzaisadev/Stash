FROM node:20-alpine

WORKDIR /usr/src/app

# Copy manifests first so this layer is cached unless dependencies change.
COPY package*.json ./

# `npm ci` installs exactly what package-lock.json pins, which is what a
# reproducible deploy needs. `npm install` can silently resolve a different
# tree than the one that was tested.
RUN npm ci --omit=dev

COPY . .

# The host decides the port and passes it in as PORT (Render, Railway and Fly
# all do), and server.js already reads it. This EXPOSE documents the default
# only — it was previously pinned to 7860 for Hugging Face Spaces, which is not
# what other hosts route to.
ENV PORT=5000
EXPOSE 5000

CMD [ "npm", "start" ]
