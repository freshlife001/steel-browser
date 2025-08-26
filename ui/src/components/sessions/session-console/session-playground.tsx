import { useState, useEffect } from "react";
import { env } from "@/env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface OpenAPIEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: "query" | "path" | "header" | "body";
    required: boolean;
    schema?: any;
    description?: string;
  }>;
  requestBody?: {
    content?: {
      "application/json"?: {
        schema?: any;
      };
    };
  };
  responses?: Record<string, {
    description?: string;
    content?: {
      "application/json"?: {
        schema?: any;
      };
    };
  }>;
}

interface OpenAPISchema {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, Record<string, OpenAPIEndpoint>>;
  components?: {
    schemas?: Record<string, any>;
  };
}

interface SessionPlaygroundProps {
  id: string | null;
}

export default function SessionPlayground({ id }: SessionPlaygroundProps) {
  // Session ID can be used to auto-populate session-related parameters in the future
  console.log('Session ID:', id);
  const [schema, setSchema] = useState<OpenAPISchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [requestBody, setRequestBody] = useState<string>("");
  const [requestBodyError, setRequestBodyError] = useState<string | null>(null);
  const [requestBodyMode, setRequestBodyMode] = useState<"raw" | "form">("form");
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [response, setResponse] = useState<any>(null);
  const [responseLoading, setResponseLoading] = useState(false);
  const [responseMode, setResponseMode] = useState<"raw" | "form">("form");
  const [endpoints, setEndpoints] = useState<Array<{ path: string; method: string; summary?: string }>>([]);

  useEffect(() => {
    fetchOpenAPISchema();
  }, []);

  const fetchOpenAPISchema = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${env.AUTOMATION_API_URL}/openapi.json`);
      if (!response.ok) {
        throw new Error(`Failed to fetch OpenAPI schema: ${response.status}`);
      }
      const schemaData = await response.json();
      setSchema(schemaData);
      
      // Extract endpoints
      const extractedEndpoints: Array<{ path: string; method: string; summary?: string }> = [];
      Object.entries(schemaData.paths).forEach(([path, methods]) => {
        Object.entries(methods as any).forEach(([method, endpoint]: [string, any]) => {
          if (method !== 'parameters') {
            extractedEndpoints.push({
              path,
              method: method.toUpperCase(),
              summary: endpoint.summary,
            });
          }
        });
      });
      setEndpoints(extractedEndpoints);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch OpenAPI schema");
    } finally {
      setLoading(false);
    }
  };

  const handleEndpointChange = (endpointKey: string) => {
    const [method, path] = endpointKey.split(" ");
    setSelectedMethod(method);
    setSelectedEndpoint(path);
    setParameters({});
    setResponse(null);
    setResponseMode("form");
    setRequestBodyError(null);
    setRequestBodyMode("form");
    setFormData({});
    
    // Auto-populate request body template for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const endpointDetails = schema?.paths[path]?.[method.toLowerCase()];
      if (endpointDetails?.requestBody?.content?.['application/json']?.schema) {
        const requestBodySchema = resolveSchemaRef(endpointDetails.requestBody.content['application/json'].schema, schema);
        const template = generateRequestBodyTemplate(requestBodySchema);
        if (template) {
          setRequestBody(JSON.stringify(template, null, 2));
          setFormData(jsonToFormData(template, requestBodySchema));
        } else {
          setRequestBody("");
          setFormData({});
        }
      } else {
        setRequestBody("");
        setFormData({});
      }
    } else {
      setRequestBody("");
      setFormData({});
    }
  };

  const getEndpointDetails = () => {
    if (!schema || !selectedEndpoint || !selectedMethod) return null;
    return schema.paths[selectedEndpoint]?.[selectedMethod.toLowerCase()];
  };

  const resolveSchemaRef = (schema: any, openapiSchema: OpenAPISchema | null, visitedRefs: Set<string> = new Set()): any => {
    if (!schema || !openapiSchema) return schema;
    
    if (schema.$ref) {
      const refPath = schema.$ref;
      if (refPath.startsWith('#/components/schemas/')) {
        // Check for circular references
        if (visitedRefs.has(refPath)) {
          return schema; // Return the ref itself to prevent infinite recursion
        }
        visitedRefs.add(refPath);
        
        const schemaName = refPath.replace('#/components/schemas/', '');
        const resolvedSchema = openapiSchema.components?.schemas?.[schemaName] || schema;
        
        // Continue resolving the referenced schema
        const fullyResolved = resolveSchemaRef(resolvedSchema, openapiSchema, visitedRefs);
        visitedRefs.delete(refPath); // Backtrack
        return fullyResolved;
      }
    }
    
    // Handle nested refs
    if (schema.properties) {
      const resolvedProperties: any = {};
      Object.entries(schema.properties).forEach(([key, value]: [string, any]) => {
        resolvedProperties[key] = resolveSchemaRef(value, openapiSchema, visitedRefs);
      });
      return { ...schema, properties: resolvedProperties };
    }
    
    if (schema.items) {
      return { ...schema, items: resolveSchemaRef(schema.items, openapiSchema, visitedRefs) };
    }
    
    if (schema.anyOf) {
      return { ...schema, anyOf: schema.anyOf.map((item: any) => resolveSchemaRef(item, openapiSchema, visitedRefs)) };
    }
    
    if (schema.oneOf) {
      return { ...schema, oneOf: schema.oneOf.map((item: any) => resolveSchemaRef(item, openapiSchema, visitedRefs)) };
    }
    
    if (schema.allOf) {
      return { ...schema, allOf: schema.allOf.map((item: any) => resolveSchemaRef(item, openapiSchema, visitedRefs)) };
    }
    
    return schema;
  };

  const jsonToFormData = (json: any, schema: any): Record<string, any> => {
    if (!schema || !json) return {};
    
    if (schema.type === "object" && schema.properties) {
      const result: Record<string, any> = {};
      Object.entries(schema.properties).forEach(([key, propSchema]: [string, any]) => {
        if (json[key] !== undefined) {
          if (propSchema.type === "object" && propSchema.properties) {
            result[key] = jsonToFormData(json[key], propSchema);
          } else {
            result[key] = json[key];
          }
        }
      });
      return result;
    }
    
    return json;
  };

  const validateRequestBody = () => {
    if (!requestBody.trim()) return true;
    
    try {
      JSON.parse(requestBody);
      setRequestBodyError(null);
      return true;
    } catch (error) {
      setRequestBodyError("Invalid JSON format");
      return false;
    }
  };

  const executeRequest = async () => {
    const endpointDetails = getEndpointDetails();
    if (!endpointDetails) return;

    // Validate request body if present
    let finalRequestBody = requestBody;
    if (requestBodyMode === "form") {
      const endpointDetails = getEndpointDetails();
      const requestBodySchema = endpointDetails?.requestBody?.content?.['application/json']?.schema;
      const resolvedSchema = requestBodySchema ? resolveSchemaRef(requestBodySchema, schema) : null;
      finalRequestBody = JSON.stringify(formDataToJSON(formData, resolvedSchema), null, 2);
      setRequestBody(finalRequestBody);
    }
    
    if (finalRequestBody.trim() && !validateRequestBody()) {
      return;
    }

    setResponseLoading(true);
    try {
      // Build URL with query parameters
      let url = `${env.AUTOMATION_API_URL}${selectedEndpoint}`;
      const queryParams = new URLSearchParams();
      
      // Add parameters
      Object.entries(parameters).forEach(([key, value]) => {
        if (value) {
          const param = endpointDetails.parameters?.find(p => p.name === key);
          if (param?.in === 'query') {
            queryParams.append(key, value);
          }
        }
      });

      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }

      // Build request options
      const options: RequestInit = {
        method: selectedMethod,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      // Add request body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(selectedMethod) && finalRequestBody) {
        options.body = finalRequestBody;
      }

      // Add path parameters
      let finalUrl = url;
      endpointDetails.parameters?.forEach(param => {
        if (param.in === 'path' && parameters[param.name]) {
          finalUrl = finalUrl.replace(`{${param.name}}`, parameters[param.name]);
        }
      });

      const response = await fetch(finalUrl, options);
      const data = await response.json();
      setResponse({
        status: response.status,
        statusText: response.statusText,
        data,
        url: finalUrl,
      });
    } catch (err) {
      setResponse({
        error: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setResponseLoading(false);
    }
  };

  const renderParameterInput = (param: any) => {
    const value = parameters[param.name] || "";
    
    if (param.schema?.type === "boolean") {
      return (
        <Select value={value} onValueChange={(v) => setParameters(prev => ({ ...prev, [param.name]: v }))}>
          <SelectTrigger>
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">True</SelectItem>
            <SelectItem value="false">False</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        type={param.schema?.type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => setParameters(prev => ({ ...prev, [param.name]: e.target.value }))}
        placeholder={param.description || param.name}
      />
    );
  };

  const formDataToJSON = (formData: Record<string, any>, schema: any): any => {
    if (!schema) return {};
    
    if (schema.type === "object" && schema.properties) {
      const result: any = {};
      Object.entries(schema.properties).forEach(([key, propSchema]: [string, any]) => {
        const value = formData[key];
        if (value !== undefined && value !== "") {
          if (propSchema.type === "number" || propSchema.type === "integer") {
            result[key] = Number(value);
          } else if (propSchema.type === "boolean") {
            result[key] = value === "true" || value === true;
          } else if (propSchema.type === "object" && propSchema.properties) {
            result[key] = formDataToJSON(formData, propSchema);
          } else {
            result[key] = value;
          }
        }
      });
      return result;
    }
    
    return formData;
  };

  const renderResponseField = (key: string, value: any, schema: any, path: string = "", isRoot: boolean = false) => {
    // Root level object - render as table
    if (isRoot && schema.type === "object" && schema.properties) {
      const properties = Object.entries(schema.properties);
      const data = value || {};
      
      // Special handling for TaskListResponse - show tasks array as table
      if (key === "response" && properties.some(([propKey]) => propKey === "tasks")) {
        const tasksProperty = properties.find(([propKey]) => propKey === "tasks");
        if (tasksProperty) {
          const [tasksKey, tasksSchema] = tasksProperty;
          const tasksData = data[tasksKey];
          
          return (
            <div className="space-y-4">
              {/* Render non-tasks properties as two-column table */}
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-gray-900 px-3 py-2 border-b border-gray-700">
                  <span className="text-sm font-medium text-gray-300">Pagination Info</span>
                </div>
                <div className="p-3 bg-gray-800">
                  {renderObjectAsTwoColumnTable(
                    Object.fromEntries(properties.filter(([propKey]) => propKey !== "tasks").map(([key]) => [key, data[key]])),
                    {
                      type: "object",
                      properties: Object.fromEntries(properties.filter(([propKey]) => propKey !== "tasks"))
                    }
                  )}
                </div>
              </div>
              
              {/* Render tasks array as separate table */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">Tasks ({Array.isArray(tasksData) ? tasksData.length : 0})</h4>
                {Array.isArray(tasksData) && (tasksSchema as any).type === "array" && (tasksSchema as any).items ? (
                  renderArrayAsTable(tasksData, (tasksSchema as any).items, `${path}.${tasksKey}`)
                ) : (
                  <div className="text-sm text-gray-500">No tasks data</div>
                )}
              </div>
            </div>
          );
        }
      }
      
      // Default object rendering - use two-column table for better readability
      return (
        <div className="border border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-gray-900 px-3 py-2 border-b border-gray-700">
            <span className="text-sm font-medium text-gray-300">Response Data</span>
          </div>
          <div className="p-3 bg-gray-800">
            {renderObjectAsTwoColumnTable(data, schema)}
          </div>
        </div>
      );
    }
    
    // Root level array - render as table
    if (isRoot && schema.type === "array" && schema.items && Array.isArray(value)) {
      return renderArrayAsTable(value, schema.items, path);
    }
    
    // Nested objects - continue with form rendering
    if (schema.type === "object" && schema.properties) {
      return (
        <div className="space-y-4">
          {Object.entries(schema.properties).map(([propKey, propSchema]: [string, any]) => (
            <div key={propKey} className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">
                  {propKey}
                  {schema.required?.includes(propKey) && <span className="text-red-500">*</span>}
                </Label>
                <span className="text-xs text-gray-500">({propSchema.type})</span>
              </div>
              {renderResponseField(propKey, value?.[propKey], propSchema, path ? `${path}.${propKey}` : propKey)}
            </div>
          ))}
        </div>
      );
    } else if (schema.type === "array" && schema.items) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">{key}</Label>
            <span className="text-xs text-gray-500">(array of {schema.items.type})</span>
          </div>
          {Array.isArray(value) ? value.map((item, index) => (
            <div key={index} className="space-y-2 border border-gray-200 rounded p-2">
              {renderResponseField(`${key}[${index}]`, item, schema.items, `${path}[${index}]`)}
            </div>
          )) : (
            <div className="text-sm text-gray-500">No data</div>
          )}
        </div>
      );
    } else if (schema.enum) {
      return (
        <div className="text-sm">
          <span className="font-medium">{key}: </span>
          <span className="capitalize">{value}</span>
        </div>
      );
    }

    return (
      <div className="text-sm">
        <span className="font-medium">{key}: </span>
        <span>{value !== null && value !== undefined ? String(value) : "null"}</span>
      </div>
    );
  };

  const renderNestedObject = (value: any, schema: any) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-500">null</span>;
    }
    
    // Check if the value is actually an object or array, regardless of schema
    const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
    const isArray = Array.isArray(value);
    
    // For nested objects, always show as raw JSON
    if (isObject || (schema.type === "object" && schema.properties)) {
      return (
        <pre className="bg-gray-900 p-2 rounded text-xs overflow-x-auto max-h-32">
          <code className="text-green-400">{JSON.stringify(value, null, 2)}</code>
        </pre>
      );
    }
    
    // For arrays, always show as raw JSON
    if (isArray || (schema.type === "array" && schema.items)) {
      return (
        <pre className="bg-gray-900 p-2 rounded text-xs overflow-x-auto max-h-32">
          <code className="text-green-400">{JSON.stringify(value, null, 2)}</code>
        </pre>
      );
    }
    
    if (schema.enum) {
      return <span className="capitalize font-medium text-gray-300">{value}</span>;
    }
    
    return <span className="text-gray-300">{String(value)}</span>;
  };

  const renderArrayAsTable = (array: any[], itemSchema: any, _path: string) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    if (array.length === 0) {
      return <div className="text-sm text-gray-500">No data</div>;
    }

    // If array items are objects with properties, render as individual two-column tables
    if (itemSchema.type === "object" && itemSchema.properties) {
      return (
        <div className="space-y-4">
          {array.map((item, index) => (
            <div key={index} className="border border-gray-700 rounded-lg overflow-hidden">
              <div className="bg-gray-900 px-3 py-2 border-b border-gray-700">
                <span className="text-sm font-medium text-gray-300">
                  Item {index + 1}{item.name && `: ${item.name}`}{item.id && ` (ID: ${item.id})`}
                </span>
              </div>
              <div className="p-3 bg-gray-800">
                {renderObjectAsTwoColumnTable(item, itemSchema)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // For primitive arrays, show as list
    return (
      <div className="space-y-1">
        {array.map((item, index) => (
          <div key={index} className="text-sm border border-gray-200 rounded p-2">
            {renderNestedObject(item, itemSchema)}
          </div>
        ))}
      </div>
    );
  };

  const renderObjectAsTwoColumnTable = (obj: any, schema: any) => {
    if (!schema.properties) {
      return (
        <pre className="bg-gray-900 p-2 rounded text-xs overflow-x-auto">
          <code className="text-green-400">{formatJSON(obj)}</code>
        </pre>
      );
    }

    const properties = Object.entries(schema.properties);
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <tbody>
            {properties.map(([propKey, propSchema]) => {
              const value = obj?.[propKey];
              const isRequired = schema.required?.includes(propKey);
              
              return (
                <tr key={propKey} className="border-b border-gray-700 last:border-0">
                  <td className="px-3 py-2 text-sm font-medium text-gray-300 align-top w-1/3 bg-gray-900">
                    <div className="flex items-center gap-1">
                      <span>{propKey}</span>
                      {isRequired && <span className="text-red-400">*</span>}
                    </div>
                    <div className="text-xs text-gray-500 font-normal">({(propSchema as any).type})</div>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-100 align-top w-2/3 bg-gray-800">
                    {renderNestedObject(value, propSchema)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderFormField = (key: string, schema: any, path: string = "") => {
    const value = formData[path] || "";
    if (schema.type === "object" && schema.properties) {
      return (
        <div className="space-y-4">
          {Object.entries(schema.properties).map(([propKey, propSchema]: [string, any]) => (
            <div key={propKey} className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">
                  {propKey}
                  {schema.required?.includes(propKey) && <span className="text-red-500">*</span>}
                </Label>
                <span className="text-xs text-gray-500">({propSchema.type})</span>
              </div>
              {renderFormField(propKey, propSchema, path ? `${path}.${propKey}` : propKey)}
            </div>
          ))}
        </div>
      );
    } else if (schema.type === "boolean") {
      return (
        <Select value={String(value)} onValueChange={(v) => setFormData(prev => ({ ...prev, [path]: v === "true" }))}>
          <SelectTrigger>
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">True</SelectItem>
            <SelectItem value="false">False</SelectItem>
          </SelectContent>
        </Select>
      );
    } else if (schema.type === "array" && schema.items) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">{key}</Label>
            <span className="text-xs text-gray-500">(array of {schema.items.type})</span>
          </div>
          {Array.isArray(value) ? value.map((_, index) => (
            <div key={index} className="space-y-2 border border-gray-200 rounded p-2">
              {renderFormField(`${key}[${index}]`, schema.items, `${path}[${index}]`)}
            </div>
          )) : (
            <div className="space-y-2 border border-gray-200 rounded p-2">
              {renderFormField(`${key}[0]`, schema.items, `${path}[0]`)}
            </div>
          )}
        </div>
      );
    } else if (schema.enum) {
      return (
        <Select value={String(value)} onValueChange={(v) => setFormData(prev => ({ ...prev, [path]: v }))}>
          <SelectTrigger>
            <SelectValue placeholder={`Select ${schema.title || key}`} />
          </SelectTrigger>
          <SelectContent>
            {schema.enum.map((enumValue: any) => (
              <SelectItem key={enumValue} value={String(enumValue)}>
                <span className="capitalize">{enumValue}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        type={schema.type === "number" || schema.type === "integer" ? "number" : "text"}
        value={value}
        onChange={(e) => setFormData(prev => ({ ...prev, [path]: e.target.value }))}
        placeholder={schema.description || key}
      />
    );
  };

  const generateRequestBodyTemplate = (schema: any): any => {
    if (!schema) return null;
    
    const generateFromSchema = (schemaObj: any): any => {
      if (schemaObj.type === 'object') {
        const obj: any = {};
        if (schemaObj.properties) {
          Object.entries(schemaObj.properties).forEach(([key, prop]: [string, any]) => {
            if (!schemaObj.required || !schemaObj.required.includes(key)) {
              return;
            }
            obj[key] = generateFromSchema(prop);
          });
        }
        return obj;
      } else if (schemaObj.type === 'array') {
        return [generateFromSchema(schemaObj.items)];
      } else if (schemaObj.type === 'string') {
        return schemaObj.example || '';
      } else if (schemaObj.type === 'number' || schemaObj.type === 'integer') {
        return schemaObj.example || 0;
      } else if (schemaObj.type === 'boolean') {
        return schemaObj.example || false;
      } else if (schemaObj.enum) {
        return schemaObj.enum[0];
      }
      return null;
    };
    
    return generateFromSchema(schema);
  };

  const formatJSON = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--gray-11)] mx-auto mb-4"></div>
          <p>Loading OpenAPI schema...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="text-center mb-4">
          <p className="text-red-600 mb-2">Failed to load OpenAPI schema</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
        <Button onClick={fetchOpenAPISchema}>Retry</Button>
      </div>
    );
  }

  const endpointDetails = getEndpointDetails();
  const currentEndpointKey = selectedMethod && selectedEndpoint ? `${selectedMethod} ${selectedEndpoint}` : "";

  return (
    <div className="flex flex-col h-full bg-[var(--gray-2)]">
      <div className="p-4 border-b border-[var(--gray-6)]">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Label htmlFor="endpoint">API Endpoint</Label>
            <Select value={currentEndpointKey} onValueChange={handleEndpointChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select an endpoint" />
              </SelectTrigger>
              <SelectContent>
                {endpoints.map((endpoint, index) => (
                  <SelectItem key={index} value={`${endpoint.method} ${endpoint.path}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                        endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                        endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                        endpoint.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {endpoint.method}
                      </span>
                      <span className="font-mono text-sm">{endpoint.path}</span>
                      {endpoint.summary && (
                        <span className="text-xs text-gray-500 ml-2">{endpoint.summary}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={executeRequest} 
            disabled={!selectedEndpoint || responseLoading}
            className="whitespace-nowrap"
          >
            {responseLoading ? "Executing..." : "Execute Request"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {endpointDetails && (
          <div className="space-y-4">
            {endpointDetails.summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{endpointDetails.summary}</CardTitle>
                  {endpointDetails.description && (
                    <CardDescription>{endpointDetails.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            )}

            {endpointDetails.parameters && endpointDetails.parameters.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Parameters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {endpointDetails.parameters.map((param, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={param.name} className="text-sm font-medium">
                          {param.name}
                          {param.required && <span className="text-red-500">*</span>}
                        </Label>
                        <span className="text-xs text-gray-500">
                          ({param.in}) {param.schema?.type}
                        </span>
                      </div>
                      {renderParameterInput(param)}
                      {param.description && (
                        <p className="text-xs text-gray-600">{param.description}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {['POST', 'PUT', 'PATCH'].includes(selectedMethod) && endpointDetails.requestBody && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Request Body</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs value={requestBodyMode} onValueChange={(value) => setRequestBodyMode(value as "raw" | "form")}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                      <TabsTrigger value="form">Form</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="raw" className="mt-4">
                      <Textarea
                        value={requestBody}
                        onChange={(e) => {
                          setRequestBody(e.target.value);
                          setRequestBodyError(null);
                        }}
                        placeholder="Enter JSON request body..."
                        className={`font-mono text-sm min-h-[100px] ${
                          requestBodyError ? 'border-red-500 focus:border-red-500' : ''
                        }`}
                      />
                      {requestBodyError && (
                        <p className="text-red-500 text-xs mt-1">{requestBodyError}</p>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="form" className="mt-4">
                      {endpointDetails.requestBody?.content?.['application/json']?.schema && (
                        <div className="space-y-4">
                          {renderFormField(
                            "root",
                            resolveSchemaRef(endpointDetails.requestBody.content['application/json'].schema, schema),
                            ""
                          )}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {response && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                Response
                {response.status && (
                  <span className={`text-xs px-2 py-1 rounded ${
                    response.status >= 200 && response.status < 300 ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {response.status} {response.statusText}
                  </span>
                )}
              </CardTitle>
              {response.url && (
                <CardDescription className="font-mono text-xs">{response.url}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {!response.error && response.data && getEndpointDetails()?.responses?.[response.status]?.content?.['application/json']?.schema ? (
                <Tabs value={responseMode} onValueChange={(value) => setResponseMode(value as "raw" | "form")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                    <TabsTrigger value="form">Form View</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="raw" className="mt-4">
                    <pre className="bg-[var(--gray-1)] p-3 rounded text-xs overflow-x-auto">
                      <code>{formatJSON(response.data)}</code>
                    </pre>
                  </TabsContent>
                  
                  <TabsContent value="form" className="mt-4">
                    <div className="space-y-4">
                      {renderResponseField(
                        "response",
                        response.data,
                        resolveSchemaRef(
                          getEndpointDetails()?.responses?.[response.status]?.content?.['application/json']?.schema,
                          schema
                        ),
                        "",
                        true
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <pre className="bg-[var(--gray-1)] p-3 rounded text-xs overflow-x-auto">
                  <code>{formatJSON(response.error || response.data)}</code>
                </pre>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}