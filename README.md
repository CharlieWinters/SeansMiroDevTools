# Miro IDE

A modular development environment inside Miro where the board is the control plane for AI-assisted coding.

## Architecture

- **Board as Control Plane**: Stickies carry tags/metadata to represent state
- **Terminal Embed**: Executes commands with variable replacement
- **MCP Client**: Brings external data into Miro
- **MCP Server**: Exposes Miro board data to coding agents
- **File Viewer**: Syntax-highlighted local code preview
- **Quick Review Bot**: Navigates and reviews board content

## Project Structure

```
├── apps/
│   └── miro-app/           # Main Miro application
│       └── src/
│           ├── core/       # Core infrastructure
│           │   ├── boardState/   # Board state reader
│           │   ├── variables/    # Variable expansion engine
│           │   ├── bus/          # Event bus for module communication
│           │   └── discovery/    # Module registry and loader
│           ├── types/      # TypeScript type definitions
│           ├── config/     # Application configuration
│           ├── utils/      # Utility functions
│           ├── schemas/    # JSON schemas
│           └── ui/         # UI components
├── modules/
│   ├── terminal-embed/     # Terminal execution module
│   ├── sync-command/       # Board sync via .miro-updates.json
│   ├── file-viewer/        # Code viewer module
│   ├── quick-review-bot/   # Navigation module
│   ├── mcp-client/         # MCP inbound module
│   └── mcp-server/         # MCP outbound module
├── shared/                 # Shared utilities across packages
└── configs/                # Build and lint configuration
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Install the app in Miro

Install this app against one of your Miro teams using this link:

[https://miro.com/app-install/?response_type=code&client_id=3458764660412827340&redirect_uri=%2Fapp-install%2Fconfirm%2F](https://miro.com/app-install/?response_type=code&client_id=3458764660412827340&redirect_uri=%2Fapp-install%2Fconfirm%2F)

Sign in to Miro when prompted and complete the install for the team where you want to use Miro IDE.

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

This starts the Vite dev server on http://localhost:3000.

### Build

```bash
pnpm build
```

## Core Infrastructure

### Board State Reader

Reads and parses board state from the Miro SDK:

```typescript
import { boardStateReader } from '@/core/boardState/boardStateReader';

// Get current selection
const selection = await boardStateReader.getSelection();

// Get items by tag
const readyItems = await boardStateReader.getItemsByTag('ready');

// Get full board state snapshot
const state = await boardStateReader.getBoardState();
```

### Variable Engine

Expands placeholders in strings with values from board state:

```typescript
import { variableEngine } from '@/core/variables/variableEngine';

// Expand variables in a command
const result = await variableEngine.expand(
  'cursor $selection --tag $metadata.status'
);

// Preview without executing
const preview = await variableEngine.preview(command);
```

**Supported Variables:**
- `$selection` / `$selection.content` - Selected item content
- `$selection.id` / `$selection.ids` - Selected item IDs
- `$selection.tags` - Tags from selected items
- `$metadata.key` - Metadata value from selection
- `$tag.tagname` - Returns 'true' if tag present
- `$frame` / `$frame.name` - Parent frame name
- `$board.id` - Current board ID

### Event Bus

Typed publish/subscribe for inter-module communication:

```typescript
import { eventBus } from '@/core/bus/eventBus';

// Subscribe to events
const sub = eventBus.on('terminal', 'command:execute', ({ command }) => {
  console.log('Executing:', command);
});

// Emit events
eventBus.emit('boardState', 'selection:changed', { itemIds: ['123'] });

// Unsubscribe
sub.unsubscribe();
```

**Channels:**
- `boardState` - Board state changes
- `files` - File operations
- `terminal` - Command execution
- `review` - Navigation events
- `mcp-inbound` - MCP client events
- `mcp-outbound` - MCP server events
- `sync` - Sync operations
- `modules` - Module lifecycle

### Module Registry

Manages module lifecycle:

```typescript
import { createModuleRegistry } from '@/core/discovery/moduleRegistry';
import { eventBus } from '@/core/bus/eventBus';

const registry = createModuleRegistry(eventBus);

// Register a module
registry.register(myModule);

// Start a module
await registry.start('my-module');

// Get module info
const modules = registry.getAllModules();
```

## Module Development

Modules implement the `MiroModule` interface:

```typescript
import type { MiroModule } from '@miro-ide/app/types/modules';

export const myModule: MiroModule = {
  id: 'my-module',
  name: 'My Module',
  description: 'Does something useful',

  registerModule(bus, sdk) {
    // Subscribe to events, set up handlers
  },

  async start(options) {
    // Initialize the module
  },

  async stop() {
    // Clean up
  },

  getState() {
    return 'active';
  },
};
```

## Tags & Conventions

### Standard Tags

- `#ready` - Item is ready for implementation
- `#in-progress` - Currently being worked on
- `#implemented` - Implementation complete
- `#needs-review` - Requires review
- `#blocked` - Blocked on dependencies
- `#bug` - Represents a bug

### Metadata Format

Use `@key=value` or `@key="value with spaces"` in item content:

```
#ready @file=src/utils.ts @assigned_to=agent
```

## License

MIT
