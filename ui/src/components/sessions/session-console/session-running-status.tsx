import { useState, useEffect, useCallback, useRef } from "react";
import { env } from "@/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, PlayCircle, CheckCircle, XCircle, Clock, AlertCircle, X } from "lucide-react";

interface TaskAction {
  id: string;
  task_id: number;
  status: "pending" | "running" | "completed" | "failed";
  result?: any;
  error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

interface SessionRunningStatusProps {
  runId: string;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}

export default function SessionRunningStatus({ runId, onComplete, onError, onClose }: SessionRunningStatusProps) {
  const [taskAction, setTaskAction] = useState<TaskAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    console.log('stopPolling');
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setPolling(false);
  }, []);

  const fetchTaskStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${env.AUTOMATION_API_URL}/api/v1/tasks/actions/${runId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch task status: ${response.status}`);
      }
      
      const data: TaskAction = await response.json();
      setTaskAction(data);
      
      // Stop polling if task is completed or failed
      if (data.status === "completed" || data.status === "failed") {
        stopPolling();
        if (data.status === "completed" && onComplete) {
          onComplete(data.result);
        } else if (data.status === "failed" && onError) {
          onError(data.error || "Task failed");
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch task status";
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
      stopPolling();
    } finally {
      setLoading(false);
    }
  }, [runId, onComplete, onError, stopPolling]);

  const startPolling = useCallback(() => {
    console.log('startPolling');
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    setPolling(true);
    // Initial fetch
    fetchTaskStatus();
    
    // Set up polling every 2 seconds
    pollingIntervalRef.current = setInterval(fetchTaskStatus, 2000);
  }, [fetchTaskStatus]);

  useEffect(() => {
    if (runId) {
      startPolling();
    }
    
    return () => {
      stopPolling();
    };
  }, [runId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-gray-100 text-gray-800";
      case "running":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt) return "N/A";
    
    const start = new Date(startedAt + 'Z'); // Append 'Z' to treat as UTC
    const end = completedAt ? new Date(completedAt + 'Z') : new Date();
    const duration = end.getTime() - start.getTime();
    
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}min`;
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return "N/A";
    return new Date(timeString + 'Z').toLocaleTimeString();
  };

  if (!runId) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <PlayCircle className="h-4 w-4" />
            Task Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">No run ID provided</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <PlayCircle className="h-4 w-4" />
              Task Running Status
              <Badge variant="outline" className="text-xs">
                ID: {runId}
              </Badge>
            </CardTitle>
            <CardDescription>
              Monitoring task execution status
            </CardDescription>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0 hover:bg-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !taskAction && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading task status...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-500">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {taskAction && (
          <div className="space-y-3">
            {/* Status Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(taskAction.status)}
                <span className="font-medium">Status:</span>
                <Badge className={getStatusColor(taskAction.status)}>
                  {taskAction.status.toUpperCase()}
                </Badge>
              </div>
              {polling && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Live
                </div>
              )}
            </div>

            {/* Task Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Task ID:</span>
                <div className="font-mono">{taskAction.task_id}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Action ID:</span>
                <div className="font-mono text-xs">{taskAction.id}</div>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-2">
              <div className="font-medium text-gray-700 text-sm">Timeline:</div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Created:</span>
                  <div>{formatTime(taskAction.created_at)}</div>
                </div>
                {taskAction.started_at && (
                  <div>
                    <span className="text-gray-500">Started:</span>
                    <div>{formatTime(taskAction.started_at)}</div>
                  </div>
                )}
                {taskAction.completed_at && (
                  <div>
                    <span className="text-gray-500">Completed:</span>
                    <div>{formatTime(taskAction.completed_at)}</div>
                  </div>
                )}
              </div>
              {taskAction.started_at && (
                <div>
                  <span className="text-gray-500">Duration:</span>
                  <div className="font-medium">{formatDuration(taskAction.started_at, taskAction.completed_at)}</div>
                </div>
              )}
            </div>

            {/* Result */}
            {taskAction.status === "completed" && taskAction.result && (
              <div className="space-y-2">
                <div className="font-medium text-gray-700 text-sm">Result:</div>
                <div className="bg-black p-3 rounded text-xs font-mono overflow-x-auto max-h-32 text-green-400">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(taskAction.result, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Error */}
            {taskAction.status === "failed" && taskAction.error && (
              <div className="space-y-2">
                <div className="font-medium text-gray-700 text-sm">Error:</div>
                <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-700">
                  {taskAction.error}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTaskStatus}
            disabled={loading}
          >
            <Loader2 className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          
          {polling ? (
            <Button
              variant="outline"
              size="sm"
              onClick={stopPolling}
            >
              Stop Polling
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={startPolling}
              disabled={!runId}
            >
              Start Polling
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}