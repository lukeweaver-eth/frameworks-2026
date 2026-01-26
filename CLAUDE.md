# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Frameworks is a spatial content structure tool for constructing compositions in 3D space. The system is self-hosting: Frameworks builds itself, using frames as both objects and functions that transform other frames.

## Core Data Model

### Frame Object Structure

A Frame is the fundamental unit with these properties:
- **count**: Integer ID
- **coordinates**: 8D position (xyzijkl)
- **contents**: String content (like markdown body)
- **called**: Name/title field
- **color**: Hex color value
- **size**: Integer (1, 2, 3, 4...)
- **chosen**: Boolean selection state
- **contexts**: Array of other frame IDs (where interfaces are generated)
- **components**: Array of other frame IDs (like subheadings/sticky notes)

## Architecture Principles

### Self-Referential System

"Everything is a framework. Frameworks are made of frames. It's frameworks all the way down."

The system is designed to bootstrap itself:
1. Frames serve as both data structures and transformation functions
2. The interface to manipulate Frameworks must be built IN Frameworks
3. A frame can generate a webpage that users interact with to generate commands

### Contexts System

Contexts are the most critical feature - they define how frames can be transformed:
- A Framework without contexts is meaningless (no way to transform frames)
- The default 'commands' context enables spatial transformations
- New contexts enable new capabilities (e.g., a 'cost' context for selling command sets)
- Contexts that make it easier to build frameworks become valuable

## Command System

Commands are single-character keys that trigger frame transformations. Key commands are case-sensitive (lowercase/uppercase perform related but different operations).

### Spatial Transformations
- `f/F` - frame/reframe
- `d/D` - duplicate
- `s/S` - scale frames/scale structure
- `t/T` - translate frame/translate cursor
- `e/E` - reflect horizontal/vertical
- `r/R` - rotate 90°/45°
- `z/Z` - snap cursor to center/snap structure to cursor

### Selection & Organization
- `a/A` - select all of color/select all
- `q/Q` - snap iterative corner/snap corner to Q selection
- `#` - frame selection with modifiers (i/k shift, j/l extend/retract)

### Content & Context
- `w/W` - name/contents
- `c/C` - context/snap cursor to center

### View & Output
- `v/V` - zoom/perspective (ijkl)
- `1-0` - camera positions (front, right, back, left, top, bottom, dolly, figure-8, orbits)
- `o/O` - svg/png output
- `h/H` - hide

### Animation & Repetition
- `m/M` - toggle animation/change interpolation
- `n/N` - repeat command/repeat N times

### Line Properties
- `L` + `i/k/j/l` - line thickness and extension

### Color
- `p/P` - change palette/select specific index

## Implementation Strategy

### Phase 1: Core Structure
Get the Frame struct correct with all required properties.

### Phase 2: Command System
Implement the command system so frames and coordinates can be modified to create structures. Design principle: "if it's pretty and intuitive people will build frameworks just because it's fun to build."

### Phase 3: Interface
Build a JavaScript app that:
1. Acts as intuitive UI for building structures
2. Logs keystrokes and commands
3. Stores commands on-chain

The commands themselves serve as the "source of truth" on Ethereum, allowing users to mint frameworks they've created.

## Key Conceptual Features

### Reinterpretable Hyperstructure
The representation is user-dependent. The underlying frame object is core truth, but how it's represented depends on the application webpage imported to the framework.

### Spatial Writing Environment
- **contents**: Markdown-like body text in frames
- **components**: Frames with their own content (like sticky notes in shared space)
- **called**: Titles for frames/components

### Bootstrapped Building
"You build the tool to show the vision of the tool so other people can build a tool that better articulates that vision which inspires the next vision and tool."

## Driving Vision

Allow thinking about dynamic things as if they were static. Allow thinking about systems as if they were structures. General-purpose spatial conceptualization tool connecting collective cognition.
