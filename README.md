# Multi-Field Text Slicer 
### for Power BI
A custom Power BI visual that allows users to search across multiple fields and filter visualizations based on text matches. This slicer provides a flexible way to filter your reports by searching for text across different tables and columns simultaneously.

![alt text](./assets/filter%20example.png)

### How It Works

1. Add one or more fields to the visual
2. Type one or more search terms in the input box, separate multiple terms with commas, doesn't matter uppercase or lowercase
3. Click the search button or press Enter
4. See which fields contained matches, grouped by table name. Also all visualisations will be filtered according to the found values
5. Click the clear button to reset the filter


### Project structure

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
├── README.md                    # Basic documentation
```

### Setup

Clone this repository
Run `npm install` to install dependencies

### Refine visual
Run `pbiviz start` to start the development server
- Activate **Developer mode** at **Settings > Developer settings**
- Open your report in Power BI Service
- Go to Edit mode
- Add the **Developer visual** from the Visualizations pane
- Check changes on the fly

### Building

Run `pbiviz package` to build the **.pbiviz** file in the **/dist** folder

