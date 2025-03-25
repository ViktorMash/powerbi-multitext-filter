# Multi-Field Text Slicer 
allows users to search across multiple fields and filter Power BI reports based on matches. The implementation includes a search box with filter/clear buttons and displays matched fields grouped by table name.

### Features

**Multi-field searching:** Search across all selected fields at once. Enter multiple search terms separated by commas
**Results display:** See which tables and fields contain matching values
**Case-insensitive:** Matches text regardless of case

### Structure

```bash
multitext_filter/
├── src/                         # Source code directory
│   ├── visual.ts                # Main implementation with UI rendering and filtering logic
│   └── settings.ts              # For visual settings configuration (currently empty)
│
├── style/                       # Styling directory
│   └── visual.less              # CSS styling for the visual (using LESS preprocessor)
│
├── assets/                      # Assets directory
│   └── icon.png                 # Icon displayed in the Power BI visualizations pane
│
├── dist/                        # Distribution directory
│   ├── multitext_filter.pbiviz  # Compiled visual file for importing into Power BI
│   └── package.json             # Package info for the distribution version
│
├── pbiviz.json                  # Metadata for the visual (name, GUID, version)
├── capabilities.json            # Defines data roles and capabilities of the visual
├── tsconfig.json                # TypeScript compilation configuration
├── package.json                 # Node.js package configuration and dependencies
├── package-lock.json            # Exact versions of dependencies
#├── eslint.config.mjs            # Code quality checking configuration
├── README.md                    # Basic documentation
```

### Setup

Clone this repository
Run `npm install` to install dependencies
Run `pbiviz start` to start the development server
- Activate **Developer mode** at **Settings > Developer settings**
- Open your report in Power BI Service
- Go to Edit mode
- Add the **Developer visual** from the Visualizations pane
- Check changes on the fly

### Building

Run `pbiviz package` to build the **.pbiviz** file in the **/dist** folder

