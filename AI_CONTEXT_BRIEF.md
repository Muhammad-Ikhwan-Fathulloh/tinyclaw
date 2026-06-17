# TinyClaw — What It Is and How It Works

## What is TinyClaw?

TinyClaw is your own personal AI assistant that you can run yourself — like having your own private ChatGPT, but one that you fully control and can customize to be exactly what you want.

Think of it as a digital assistant that lives on your computer, remembers things about you, and can help you with tasks across multiple apps and platforms. You can chat with it through a web dashboard, your computer's terminal, Telegram, or WhatsApp — all from the same assistant.

## Why would someone want this?

Most AI assistants today are owned by big companies. You don't control them, they don't truly remember you from conversation to conversation, and you can't customize how they behave. TinyClaw changes that by giving you:

- **Full ownership** — Your AI runs on your machine, not some company's server
- **Persistent memory** — It remembers facts about you across multiple conversations
- **Customizable personalities** — You can create different "profiles" for different tasks (a coding assistant, a writing coach, a business analyst, etc.)
- **Multi-platform** — Chat with it from your web browser, phone, or computer terminal
- **Works offline** — Even without internet, it can still help with basic tasks

## How does it work? (The simple version)

At its heart, TinyClaw is a "brain" (a server program) that connects to different AI services (like OpenAI, Anthropic, or Google) and manages conversations. Around this brain, you have different ways to talk to it:

### The Web Dashboard
A beautiful website you open in your browser. This is the main way most people interact with TinyClaw. You can see your chat history, manage your AI profiles, upload documents, and configure settings.

### The Terminal / Command Line
For technical users who prefer typing commands in a black screen. This is fast and lightweight.

### Telegram
You can message your AI assistant as if it were a friend on Telegram. It responds in your private chat.

### WhatsApp
Same idea as Telegram — message your AI assistant through WhatsApp.

All of these connect to the same brain. You could start a conversation on the web dashboard, then continue it on your phone via WhatsApp.

## What can it do?

### Chat and Conversation
The core feature is natural conversation. You can ask questions, brainstorm ideas, get writing help, debug problems, or just have a chat. The assistant remembers the context of your conversation, so you can refer to earlier messages.

### Different Personalities (Profiles)
You can create different AI assistants for different purposes:
- **A coding assistant** — Knows programming languages, helps debug code
- **A writing coach** — Helps with essays, emails, creative writing
- **A business analyst** — Analyzes data, creates reports
- **A research assistant** — Searches the web, reads documents, summarizes information
- **A super bot** — Has extra powers like running commands on your computer

Each profile can have its own personality, instructions, and set of abilities.

### The Soul System
This is TinyClaw's most unique feature. Each AI profile has a "soul" made of text files that define:

- **Who it is** — Its identity, backstory, values
- **How it talks** — Its writing style, tone, voice
- **How it works** — Step-by-step instructions for handling tasks
- **What it remembers** — Facts about you that persist across conversations
- **Examples** — Sample conversations showing how it should respond

You can edit these files directly. It's like writing a character sheet for a role-playing game, but the character is your AI assistant.

### Tools and Abilities
The AI can use "tools" to do things beyond just talking:

- **Search files** — Look through documents on your computer
- **Web search** — Search the internet for current information
- **Read documents** — You can upload PDFs and documents; the AI can read and reference them
- **Write files** — Create or edit files on your computer
- **Remember facts** — Save information about you for future conversations
- **Save skills** — Store step-by-step procedures the AI can follow later

### Automations
You can describe a task in plain English, and the AI will create an automation that runs it for you. For example:

- "Every morning, check my calendar and send me a summary"
- "When I get a new email about invoices, save the attachment to my invoices folder"
- "Every week, search for news about AI and send me a summary"

These automations can run on a schedule or be triggered manually.

### Knowledge Base
Upload documents, PDFs, and files to your personal knowledge base. The AI can then search and reference these documents when answering your questions. It's like having a personal librarian who knows everything in your files.

### MCP Servers (Connecting to Other Apps)
TinyClaw can connect to other apps and services through something called MCP (Model Context Protocol). This means your AI assistant can:
- Query your databases
- Access your project management tools
- Read your code repositories
- Control your smart home devices
- Interact with any app that supports MCP

## How is it built?

TinyClaw is built using modern software development practices:

- **TypeScript** — A programming language that helps catch errors early
- **Bun** — A fast JavaScript runtime (like Node.js but faster)
- **SQLite** — A lightweight database for storing your profiles, settings, and automations
- **Monorepo** — All parts of the project live in one place, making it easier to manage

The project is open-source (MIT license), meaning anyone can read the code, contribute improvements, or modify it for their own needs.

## Who is this for?

TinyClaw is designed for people who want more control over their AI assistants:

- **Privacy-conscious users** — Your conversations stay on your machine
- **Power users** — Customize the AI to work exactly how you want
- **Developers** — Extend it with custom tools and integrations
- **Businesses** — Create specialized AI assistants for different roles
- **AI enthusiasts** — Experiment with different personalities and capabilities
- **Anyone who wants an AI that actually remembers them** — Unlike most AI chatbots, TinyClaw builds up a memory of who you are over time

## The current state

As of mid-2026, TinyClaw is a fully functional project that is actively being improved. It already supports:

- Multiple AI providers (OpenAI, Anthropic, Google, and others)
- Task management system
- Custom skills and procedures
- Multi-provider switching
- User accounts for the web dashboard
- Telegram and WhatsApp integration
- Document upload and knowledge base search
- Usage tracking and cost monitoring

## Getting started

To try TinyClaw, you need to:
1. Install the Bun runtime (a one-time setup)
2. Download the TinyClaw code
3. Run a few simple commands
4. Open your web browser to the dashboard

On first run, it will ask you to provide an API key from an AI provider (like OpenAI). This key is how the AI assistant connects to the language models. Your key is stored locally on your computer — never sent anywhere else.

## The big picture

TinyClaw represents a vision of AI where the user is in control. Instead of relying on a company's AI assistant that changes its rules, limits your usage, or doesn't remember you, you have your own AI that:

- **Learns about you** over time
- **Works the way you want** it to work
- **Connects to your tools** and data
- **Respects your privacy** by running locally
- **Can be customized** endlessly with different personalities, skills, and automations

It's like having a personal assistant who actually gets to know you, rather than a chatbot that starts from scratch every time.

---

*This document explains TinyClaw in plain language. For technical details, see the README.md and ARCHITECTURE.md files.*
