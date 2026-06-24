# Groq RAG

A lightweight Vite + React demo for a Groq-powered retrieval-augmented generation (RAG) chat interface. You can paste in a Groq API key, upload text-based documents, and ask questions against the loaded knowledge base.

## Features

- Groq chat completions with `llama-3.3-70b-versatile`
- Simple RAG workflow using uploaded documents as inline context
- Drag-and-drop or file picker support for `.txt`, `.md`, `.csv`, and `.json` files
- Document search and removable knowledge-base items
- Example prompts and a live response-time badge
- Clean responsive UI built with React and inline styling

## Requirements

- Node.js 18+ recommended
- A Groq API key from [console.groq.com](https://console.groq.com)

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open the local Vite URL shown in the terminal.

## Usage

1. Open the app in your browser.
2. Enter your Groq API key in the sidebar and save it.
3. Add documents by dragging and dropping files into the knowledge-base panel or by browsing for files.
4. Ask a question in the chat box or click one of the suggested prompts.

The app sends the current documents and chat history to Groq for each response. Uploaded files are read in the browser and kept in memory only for the current session.

## Scripts

- `npm run dev` - start the Vite development server
- `npm run build` - create a production build

## Project Structure

```text
groq-rag/
	index.html
	package.json
	README.md
	vite.config.js
	src/
		App.jsx
		main.jsx
```

## Notes

- The app does not persist your API key or uploaded documents after a page refresh.
- Document retrieval is intentionally simple: the selected documents are injected directly into the prompt context.
- For larger or production RAG systems, you would usually add chunking, embeddings, vector search, and persistence.

## Troubleshooting

- If the app shows `Please enter and save your Groq API key first.`, save a valid key in the sidebar before sending a message.
- If requests fail, verify that your API key is active and that you have network access to the Groq API.
- If the dev server does not start, make sure dependencies installed successfully and that Node.js is available on your machine.