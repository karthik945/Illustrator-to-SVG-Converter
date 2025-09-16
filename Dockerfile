# Step 1: Start with a lightweight version of Linux that includes Node.js
FROM node:18-slim

# Step 2: Update the package manager and install our required system tools
RUN apt-get update && apt-get install -y \
    ghostscript \
    pdf2svg \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Step 3: Create a directory inside our container to hold the app
WORKDIR /app

# Step 4: Copy the package files and install Node.js dependencies
COPY package*.json ./
RUN npm install

# Step 5: Copy the rest of our application code
COPY . .

# Step 6: Tell Render that our application will be listening on a specific port
EXPOSE 3000

# Step 7: The command to run when the server starts
CMD ["node", "server.js"]