# Simple Auto-Versioning Workflow

## ✅ Setup Complete!

Your workflow now has **automatic version management** - no more filename conflicts!

## How It Works

1. **version.json** tracks the current version
2. **Build** auto-increments the version (3.1.0 → 3.1.1 → 3.1.2...)
3. **Upload** uses the new version number
4. **Deploy** records the renderer address

## Your 3-Step Workflow

```bash
# 1. Build (auto-increments version)
node scripts/build-combined.js

# 2. Upload to ETHFS
npx hardhat run scripts/upload-combined-to-ethfs.js --network sepolia

# 3. Deploy renderer
npx hardhat run scripts/deploy-renderer-quick.js --network sepolia
```

## What Gets Created

Each build creates a **unique filename**:
- `frameworks-3.1.1-combined.min.js`
- `frameworks-3.1.2-combined.min.js`
- `frameworks-3.1.3-combined.min.js`
- ...

**No more conflicts!** Each version is a new file on ETHFS.

## Development Loop

```bash
# 1. Edit src/core.js (or any module)

# 2. Test locally
open index-instanced.html

# 3. Build (version: 3.1.1 → 3.1.2)
node scripts/build-combined.js

# 4. Upload
npx hardhat run scripts/upload-combined-to-ethfs.js --network sepolia

# 5. Update contract filename (one time)
# Edit contracts/FrameworksRendererV3.sol line 114:
bodyTags[3].name = "frameworks-3.1.2-combined.min.js";

# 6. Deploy renderer
npx hardhat run scripts/deploy-renderer-quick.js --network sepolia

# 7. Get it registered by Mint owner, then mint!
```

## Version History

Check `version.json` to see all versions:
```json
{
  "current": "3.1.2",
  "history": [
    {
      "version": "3.1.1",
      "ethfsFile": "frameworks-3.1.1-combined.min.js",
      "renderer": "0x...",
      "uploadDate": "2026-02-09",
      "pointers": ["0x...", "0x..."],
      "size": 46724,
      "gasUsed": "10382836"
    }
  ]
}
```

## Manual Version Control

Want to skip a version or do a major bump?

```bash
# Edit version.json directly
{
  "current": "3.2.0",  # <- Change this
  "history": [...]
}

# Next build will be 3.2.1
```

## That's It!

Every build automatically:
- ✅ Increments version
- ✅ Creates unique filename
- ✅ No ETHFS conflicts
- ✅ Tracks history

Just code → build → upload → deploy!
