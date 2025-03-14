import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;

interface TextSlicerDataPoint {
    value: string;
    tableName: string;
    columnName: string;
    selectionId: ISelectionId;
}

interface MatchedField {
    tableName: string;
    columnName: string;
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private container: HTMLElement;
    private textInput: HTMLInputElement;
    private filterButton: HTMLButtonElement;
    private clearButton: HTMLButtonElement;
    private targetColumns: powerbi.DataViewMetadataColumn[] = [];
    private dataPoints: TextSlicerDataPoint[] = [];
    private resultsContainer: HTMLElement;
    
    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = options.host.createSelectionManager();
        
        // Create container
        this.container = document.createElement("div");
        this.container.className = "text-slicer-container";
        options.element.appendChild(this.container);
        
        // Create text input field
        this.textInput = document.createElement("input");
        this.textInput.type = "text";
        this.textInput.className = "slicer-text-input";
        this.textInput.placeholder = "Enter values (comma separated)";
        this.container.appendChild(this.textInput);
        
        // Container for buttons
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "button-container";
        this.container.appendChild(buttonContainer);
        
        // Create apply filter button
        this.filterButton = document.createElement("button");
        this.filterButton.textContent = "Apply Filter";
        this.filterButton.className = "slicer-filter-button";
        buttonContainer.appendChild(this.filterButton);
        
        // Create clear filter button
        this.clearButton = document.createElement("button");
        this.clearButton.textContent = "Clear";
        this.clearButton.className = "slicer-clear-button";
        buttonContainer.appendChild(this.clearButton);
        
        // Create results container
        this.resultsContainer = document.createElement("div");
        this.resultsContainer.className = "results-container";
        this.container.appendChild(this.resultsContainer);
        
        // Add event handlers
        this.filterButton.addEventListener("click", () => {
            this.applyFilter();
        });
        
        this.clearButton.addEventListener("click", () => {
            this.textInput.value = "";
            this.clearFilter();
        });
        
        this.textInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                this.applyFilter();
            }
        });
        
        // Add styles
        this.addStyles();
    }
    
    private addStyles() {
        const style = document.createElement("style");
        style.textContent = `
            .text-slicer-container {
                display: flex;
                flex-direction: column;
                padding: 10px;
                height: 100%;
                box-sizing: border-box;
                font-family: "Segoe UI", sans-serif;
                overflow: auto;
            }
            
            .slicer-text-input {
                padding: 8px;
                margin-bottom: 10px;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 14px;
            }
            
            .button-container {
                display: flex;
                gap: 8px;
                margin-bottom: 10px;
            }
            
            .slicer-filter-button {
                padding: 8px;
                background-color: #0078D4;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                flex: 1;
            }
            
            .slicer-clear-button {
                padding: 8px;
                background-color: #f0f0f0;
                color: #333;
                border: 1px solid #ccc;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }
            
            .slicer-filter-button:hover {
                background-color: #0069BD;
            }
            
            .slicer-clear-button:hover {
                background-color: #e0e0e0;
            }
            
            .filter-message {
                padding: 10px;
                background-color: #f0f0f0;
                margin-bottom: 10px;
                border-radius: 4px;
                font-size: 12px;
            }
            
            .results-container {
                display: flex;
                flex-direction: column;
                gap: 5px;
                overflow-y: auto;
                max-height: calc(100% - 100px);
            }
            
            .matched-fields {
                padding: 8px;
                background-color: #f0f7ff;
                border-radius: 4px;
                font-size: 12px;
                border-left: 3px solid #0078D4;
            }
            
            .field-entry {
                margin: 3px 0;
            }
            
            .table-name {
                font-weight: bold;
            }
            
            .column-name {
                margin-left: 10px;
            }
            
            .no-results {
                padding: 8px;
                background-color: #fff4e5;
                border-radius: 4px;
                font-size: 12px;
                border-left: 3px solid #ff8c00;
            }
        `;
        document.head.appendChild(style);
    }
    
    private applyFilter() {
        const filterText = this.textInput.value.trim();
        
        // Clear results
        this.clearResults();
        
        // If the field is empty, reset the filter
        if (!filterText) {
            this.clearFilter();
            return;
        }
        
        // Split the entered text into values by comma
        const filterValues = filterText.split(',')
            .map(value => value.trim())
            .filter(value => value.length > 0);
        
        if (filterValues.length === 0) {
            this.clearFilter();
            return;
        }
        
        // Apply filter only if there are target columns
        if (this.targetColumns.length > 0) {
            // Create selection for each value and apply filter
            this.applyMultiFieldFilter(filterValues);
        } else {
            // Show message about missing columns for filtering
            this.showErrorMessage("No fields selected for filtering");
        }
    }
    
    private applyMultiFieldFilter(filterValues: string[]) {
        if (this.targetColumns.length === 0 || this.dataPoints.length === 0) {
            return;
        }
        
        // Find matching dataPoints and their fields
        const matchingPoints = this.dataPoints.filter(dataPoint => 
            filterValues.some(filterValue => 
                dataPoint.value.toLowerCase().includes(filterValue.toLowerCase())
            )
        );
        
        // If we have matches, apply the filter
        if (matchingPoints.length > 0) {
            // Get unique table.column combinations where matches were found
            const matchedFields: MatchedField[] = [];
            const fieldMap = new Map<string, MatchedField>();
            
            matchingPoints.forEach(point => {
                const key = `${point.tableName}.${point.columnName}`;
                if (!fieldMap.has(key)) {
                    fieldMap.set(key, {
                        tableName: point.tableName,
                        columnName: point.columnName
                    });
                }
            });
            
            // Convert map to array
            fieldMap.forEach(field => matchedFields.push(field));
            
            // Group fields by table
            const tableFieldsMap = new Map<string, string[]>();
            matchedFields.forEach(field => {
                if (!tableFieldsMap.has(field.tableName)) {
                    tableFieldsMap.set(field.tableName, []);
                }
                tableFieldsMap.get(field.tableName).push(field.columnName);
            });
            
            // Collect all selection IDs
            const selectionIds = matchingPoints.map(p => p.selectionId);
            
            // Apply selection through Selection API
            this.selectionManager.select(selectionIds, false)
                .then(() => {
                    // Display which fields matched (grouped by table)
                    this.displayMatchedFields(tableFieldsMap, filterValues);
                    console.log("Filter applied with matches in", matchedFields.length, "fields");
                })
                .catch(error => {
                    console.error("Error applying filter:", error);
                });
        } else {
            // If no matches, show empty result and apply empty selection
            this.applyEmptySelection();
            this.showNoResults(filterValues);
        }
    }
    
    private displayMatchedFields(tableFieldsMap: Map<string, string[]>, filterValues: string[]) {
        // Clear previous results
        this.clearResults();
        
        // Create a message for the search terms
        const messageElem = document.createElement("div");
        messageElem.className = "filter-message";
        messageElem.textContent = `Search term(s): ${filterValues.join(", ")}`;
        this.resultsContainer.appendChild(messageElem);
        
        // Create container for matched fields
        const matchedFieldsElem = document.createElement("div");
        matchedFieldsElem.className = "matched-fields";
        
        const titleElem = document.createElement("strong");
        titleElem.textContent = "Found in:";
        matchedFieldsElem.appendChild(titleElem);
        
        // Convert map to array and sort by table name
        const tables = Array.from(tableFieldsMap.keys()).sort();
        
        // Add each table and its fields
        tables.forEach(tableName => {
            const fields = tableFieldsMap.get(tableName).sort(); // Sort fields alphabetically
            
            const tableEntry = document.createElement("div");
            tableEntry.className = "field-entry";
            
            const tableNameElem = document.createElement("div");
            tableNameElem.className = "table-name";
            tableNameElem.textContent = tableName;
            tableEntry.appendChild(tableNameElem);
            
            // Add each field within this table
            fields.forEach(fieldName => {
                const fieldElem = document.createElement("div");
                fieldElem.className = "column-name";
                fieldElem.textContent = fieldName;
                tableEntry.appendChild(fieldElem);
            });
            
            matchedFieldsElem.appendChild(tableEntry);
        });
        
        this.resultsContainer.appendChild(matchedFieldsElem);
    }
    
    private showNoResults(filterValues: string[]) {
        // Clear previous results
        this.clearResults();
        
        // Create a message for no results
        const messageElem = document.createElement("div");
        messageElem.className = "no-results";
        messageElem.textContent = `No matches found for: ${filterValues.join(", ")}`;
        this.resultsContainer.appendChild(messageElem);
    }
    
    private clearResults() {
        while (this.resultsContainer.firstChild) {
            this.resultsContainer.removeChild(this.resultsContainer.firstChild);
        }
    }
    
    private applyEmptySelection() {
        // Create a non-matching selection to force empty visualizations
        const dummySelectionId = this.host.createSelectionIdBuilder()
            .createSelectionId();
            
        this.selectionManager.select(dummySelectionId, false)
            .then(() => {
                console.log("Empty selection applied");
            })
            .catch(error => {
                console.error("Error applying empty selection:", error);
            });
    }
    
    private clearFilter() {
        // Clear selection through Selection API
        this.selectionManager.clear()
            .then(() => {
                // Selection successfully cleared
                this.clearResults();
                const messageElem = document.createElement("div");
                messageElem.className = "filter-message";
                messageElem.textContent = "Filter reset";
                this.resultsContainer.appendChild(messageElem);
            })
            .catch(error => {
                console.error("Error clearing filter:", error);
            });
    }
    
    private showErrorMessage(text: string) {
        // Clear previous results
        this.clearResults();
        
        // Create error message
        const message = document.createElement("div");
        message.className = "filter-message";
        message.style.backgroundColor = "#ffe6e6";
        message.style.color = "#d32f2f";
        message.textContent = text;
        
        this.resultsContainer.appendChild(message);
    }
    
    public update(options: VisualUpdateOptions) {
        if (!options || !options.dataViews || !options.dataViews[0]) {
            return;
        }
        
        const dataView = options.dataViews[0];
        
        // Check if we have categorical data and categories
        if (dataView.categorical && dataView.categorical.categories && dataView.categorical.categories.length > 0) {
            const categories = dataView.categorical.categories;
            
            // Store all target columns
            this.targetColumns = categories.map(category => category.source);
            
            // Clear previous dataPoints
            this.dataPoints = [];
            
            // Process each category (field)
            categories.forEach(category => {
                // Get the column name and table name for this category
                const columnName = category.source.displayName;
                const tableName = this.getTableName(category.source);
                
                // Process values for this category
                category.values.forEach((value, index) => {
                    const strValue = String(value);
                    
                    // Create selection ID for this specific value in this specific category
                    const selectionId = this.host.createSelectionIdBuilder()
                        .withCategory(category, index)
                        .createSelectionId();
                    
                    // Add to our dataPoints collection
                    this.dataPoints.push({
                        value: strValue,
                        tableName: tableName,
                        columnName: columnName,
                        selectionId: selectionId
                    });
                });
            });
        }
    }
    
    // Helper to extract table name from column metadata
    private getTableName(column: powerbi.DataViewMetadataColumn): string {
        if (!column) return "Unknown";
        
        // Try to get table name from queryName (format: 'TableName.ColumnName')
        if (column.queryName && column.queryName.indexOf('.') > 0) {
            return column.queryName.split('.')[0];
        }
        
        // If we can't determine table name, use a default
        return "Data";
    }
    
    public destroy(): void {
        // Clean up event handlers
        this.filterButton.removeEventListener("click", this.applyFilter);
        this.clearButton.removeEventListener("click", () => {
            this.textInput.value = "";
            this.clearFilter();
        });
        this.textInput.removeEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                this.applyFilter();
            }
        });
    }
}