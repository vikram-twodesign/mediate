'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { UploadCloud, Mic, Square, Loader2, AlertTriangle, Info } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

// Define types for better state management
interface TranscriptLine {
  id: number;
  text: string;
  speaker?: string; // Optional: Add speaker later if needed
}

// Placeholder data - Now used as initial state only
const initialTranscript: TranscriptLine[] = [
  // { id: 1, text: "Doctor: Good morning, Mrs. Davis. What brings you in today?" },
  // { id: 2, text: "Patient: Good morning, Doctor. I've been having these persistent headaches for the past week, especially in the mornings." },
  // ... other placeholders ...
];

// Get backend URL from environment variable or default
// In Next.js, frontend environment variables must be prefixed with NEXT_PUBLIC_
// This should be set in .env.local as NEXT_PUBLIC_API_URL=http://localhost:8000
// For production, set in your deployment environment to the actual backend URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE_URL) {
  console.error("FATAL ERROR: NEXT_PUBLIC_API_URL is not defined. Check environment variables.");
  // In a real component, you might want to show an error state to the user
  // instead of just logging to the console.
}

// Define type for Analysis Data
// Update symptom structure
interface Symptom {
  description: string;
  is_primary: boolean;
}

// Update severity structure
interface Severity {
  level: string;
  rationale: string;
}

// Update diagnosis structure
interface Diagnosis {
  name: string;
  confidence: string;
  rationale: string;
}

// Update main AnalysisData interface
interface AnalysisData {
  symptoms: Symptom[];
  suggestions: string[];
  severity: Severity; // Updated structure
  diagnoses: Diagnosis[]; // Updated structure
}

export default function ConsultationPage() {
  return (
    <ProtectedRoute>
      <ConsultationWorkspace />
    </ProtectedRoute>
  );
}

function ConsultationWorkspace() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // Loading state for transcription
  const [patientName, setPatientName] = useState('');
  const [transcript, setTranscript] = useState<TranscriptLine[]>(initialTranscript);
  const [error, setError] = useState<string | null>(null); // State for errors

  // --- State for AI Analysis ---
  // Update initial state for new structure
  const [analysis, setAnalysis] = useState<AnalysisData>({
    symptoms: [],
    suggestions: [],
    severity: { level: "Low", rationale: "" }, // Default severity object
    diagnoses: []
  });

  // Refs for audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Add refs for WebSocket and audio context
  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  // Update the type to allow for null AudioContext in mock mode
  const audioProcessingRef = useRef<{audioContext: AudioContext | null, stopProcessing: () => void} | null>(null);

  // Current transcription line ID for real-time updates
  const currentLineIdRef = useRef<number>(0);
  
  // Add useEffect to log API_BASE_URL in the browser
  useEffect(() => {
    console.log('BROWSER CHECK - API_BASE_URL:', API_BASE_URL);
  }, []); // Empty dependency array ensures this runs only once on mount

  // -- HELPER FUNCTIONS --

  // Determine WebSocket URL based on the API base URL
  // Define this BEFORE setupWebSocket
  const getWebSocketUrl = () => {
    if (!API_BASE_URL) {
        console.error("Cannot determine WebSocket URL because API_BASE_URL is not set.");
        return null; // Return null if base URL isn't set
    }
    // Replace http/https with ws/wss
    const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
    // Remove protocol part and append WebSocket path
    const wsUrl = `${wsProtocol}://${API_BASE_URL.replace(/^https?:\/\//, '')}/ws/transcribe`;
    console.log(`Calculated WebSocket URL: ${wsUrl}`); // Log the calculated WS URL
    return wsUrl;
  };

  // Other helper functions (extractSpeakerFromText, removeSpeakerPrefix)
  const extractSpeakerFromText = (text: string): string | undefined => {
      // Simple extraction logic (improve as needed)
      const match = text.match(/^(Speaker \d+):/);
      return match ? match[1] : undefined;
  };

  const removeSpeakerPrefix = (text: string): string => {
      // Simple removal logic
      return text.replace(/^(Speaker \d+):\s*/, '');
  };

  // Cleanup function for media recorder and WebSocket
  useEffect(() => {
    return () => {
      // Clean up media recorder
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      
      // Clean up WebSocket
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
      
      // Clean up audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  /**
   * Sets up WebSocket connection with retry logic and fallbacks
   * @returns WebSocket connection for transcription
   * @throws Error if WebSocket URL cannot be determined or connection fails
   */
  const setupWebSocket = (): WebSocket => {
    // Close existing connection if there is one
    if (websocketRef.current) {
      try {
        websocketRef.current.close();
      } catch (error) {
        console.error("Error closing existing WebSocket connection:", error);
      }
    }

    // Get the WebSocket URL using the helper function which includes checks
    const wsUrl = getWebSocketUrl();

    if (!wsUrl) {
        const errorMsg = "Cannot setup WebSocket: API_BASE_URL is not configured.";
        console.error(errorMsg);
        setError(errorMsg); // Update UI state if possible
        throw new Error(errorMsg); // Throw error to prevent proceeding
    }

    // wsUrl is guaranteed to be a string here
    console.log(`Attempting WebSocket connection to backend at ${wsUrl}`);

    try {
      const newWs = new WebSocket(wsUrl);
      
      newWs.onopen = () => {
        console.log("WebSocket connection established");
        setError(null); // Clear error state if this was a reconnection
      };
      
      newWs.onmessage = (event) => {
        try {
          // Handle ping messages
          if (event.data === "pong") {
            console.log("Received pong from server");
            return;
          }
          
          // Parse incoming data as JSON
          const data = JSON.parse(event.data);
          console.log("Received WebSocket message:", data); // More detailed log for debugging
          
          if (data.type === "transcript") {
            // Use the received speaker number (defaulting to 0 if missing)
            const speakerNumber = typeof data.speaker === 'number' ? data.speaker : 0;
            // Create a display label (e.g., "Speaker 1", "Speaker 2")
            const speakerLabel = `Speaker ${speakerNumber + 1}`;
            
            setTranscript(prev => [...prev, { 
              id: Date.now(), // Use timestamp as a simple unique key
              text: data.text, // Already stripped in backend
              speaker: speakerLabel // Store the generated label
            }]);
          } else if (data.type === "analysis") {
            // Handle analysis data from backend
            if (data.data && typeof data.data === 'object') {
               console.log("Received analysis data:", data.data);
               // Update state with received analysis, providing defaults for new structure
               setAnalysis({
                   symptoms: data.data.symptoms || [],
                   suggestions: data.data.suggestions || [],
                   severity: data.data.severity || { level: "Low", rationale: "" }, // Default object if missing
                   diagnoses: data.data.diagnoses || []
               });
            } else {
                console.warn("Received analysis message with invalid data structure:", data);
            }
          } else if (data.type === "error") {
            // Handle error messages from backend/Deepgram
            console.error("Received error message:", data.message);
            setError(`Error: ${data.message}`);
          } else if (data.status === "ready" || data.type === "status") { // Include 'status' type
            // Handle ready status
            console.log("Transcription service status:", data.message || "Ready");
          } else if (data.event === "transcription") {
            // Handle event-based transcription format
            console.log("Received transcription event:", data.text);
            
            // Check if data has speaker info
            const speaker = data.speaker || extractSpeakerFromText(data.text);
            
            setTranscript(prev => [...prev, { 
              id: Date.now(), 
              text: removeSpeakerPrefix(data.text), 
              speaker: speaker 
            }]);
          } else if (data.text) {
            // Fallback for other text formats
            console.log("Received text data:", data.text);
            
            // Check if data has speaker info
            const speaker = data.speaker || extractSpeakerFromText(data.text);
            
            setTranscript(prev => [...prev, { 
              id: Date.now(), 
              text: removeSpeakerPrefix(data.text), 
              speaker: speaker 
            }]);
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
          // Optionally provide user feedback about message processing errors
          // setError("Error processing message from server.");
        }
      };
      
      newWs.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("WebSocket connection error. Please ensure the backend server is running and reachable.");
      };
      
      newWs.onclose = (event) => {
        console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}, Was Clean: ${event.wasClean}`);
        // Optionally handle reconnection logic here if needed
        // For now, just log and potentially show an error if it wasn't a clean close
        if (!event.wasClean) {
             setError("WebSocket connection closed unexpectedly.");
        }
      };
      
      websocketRef.current = newWs;
      return newWs;
    } catch (error: any) { // Type the error as any to fix the linter error
      console.error("Error setting up WebSocket connection:", error);
      setError(`Failed to connect: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Function to stream audio to the WebSocket
  const setupAudioProcessing = (stream: MediaStream, websocket: WebSocket) => {
    try {
      console.log("Setting up audio processing with Deepgram-friendly format");
      
      // Create an audio context specifically with 16kHz sample rate for Deepgram
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000 // Deepgram works best with 16kHz sample rate
      });
      audioContextRef.current = audioContext;
      
      // Create a source node from the stream
      const sourceNode = audioContext.createMediaStreamSource(stream);
      
      // Set up the processor for audio capture
      // Note: ScriptProcessorNode is deprecated and shows a warning in console
      // TODO: Replace with AudioWorkletNode in a future update for better performance
      // For now, we use ScriptProcessorNode as it's more widely supported
      const recorderBufferSize = 4096;
      let recording = true;
      
      console.log("Creating audio processor node");
      
      // Create a processor that captures raw PCM data
      const processor = audioContext.createScriptProcessor(recorderBufferSize, 1, 1);
      processorNodeRef.current = processor;
      
      // Process the audio data as it comes in
      processor.onaudioprocess = (e) => {
        if (recording && websocket && websocket.readyState === WebSocket.OPEN) {
          try {
            // Get the raw audio data (Float32Array)
            const inputData = e.inputBuffer.getChannelData(0);
            
            // Convert Float32Array (-1.0 to 1.0) to Int16Array (-32768 to 32767)
            // This matches the 'linear16' encoding expected by the backend
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
            }
            
            // Log periodically to avoid flooding the console
            // if (Math.random() < 0.005) { // Reduce logging frequency
            //   console.log(`Sending audio chunk: ${pcmData.byteLength} bytes`);
            // }
            
            // Send the raw PCM data (Int16Array) directly as binary
            // WebSocket API can handle TypedArrays like Int16Array
            if (websocket.bufferedAmount < recorderBufferSize * 2) { // Basic backpressure check
                websocket.send(pcmData.buffer); // Send the underlying ArrayBuffer
            } else {
                console.warn("WebSocket buffer full, dropping audio chunk");
            }

            // Remove the Base64 encoding logic
            /*
            try {
              // Make sure WebSocket is still open
              if (websocket.readyState !== WebSocket.OPEN) {
                console.error("WebSocket is not open, cannot send audio data");
                return;
              }
              
              // Use a smaller chunk size to avoid "Maximum call stack size exceeded"
              const uint8Array = new Uint8Array(pcmData.buffer);
              const CHUNK_SIZE = 1024; // Process in smaller chunks to avoid stack overflow
              let base64Data = '';
              
              for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
                const chunk = uint8Array.slice(i, i + CHUNK_SIZE);
                // Convert Uint8Array chunk to array of numbers for String.fromCharCode
                const chunkArray = Array.from(chunk);
                base64Data += String.fromCharCode.apply(null, chunkArray);
              }
              
              // Now convert to base64
              base64Data = btoa(base64Data);
              
              // Send the data
              websocket.send(base64Data);
            } catch (encodeErr) {
              console.error("Error encoding audio data:", encodeErr);
            }
            */
          } catch (err) {
            console.error("Error processing audio chunk:", err);
          }
        }
      };
      
      // Connect the audio nodes
      sourceNode.connect(processor);
      processor.connect(audioContext.destination);
      
      console.log("Audio processing pipeline set up successfully");
      
      // Return the audio context and a function to stop processing
      return {
        audioContext,
        stopProcessing: () => {
          console.log("Stopping audio processing");
          recording = false;
          if (processorNodeRef.current) {
            processorNodeRef.current.disconnect();
            processorNodeRef.current = null;
          }
        }
      };
    } catch (err) {
      console.error('Error setting up audio processing:', err);
      throw err;
    }
  };

  // Mock transcription for demo/testing purposes
  const simulateTranscription = () => {
    console.log("Using simulated transcription for demo");
    const mockConversation = [
      { text: "Good morning. What brings you in today?", speaker: "Doctor" },
      { text: "Hello doctor, I've been having some headaches lately.", speaker: "Patient" },
      { text: "I'm sorry to hear that. Can you tell me more about these headaches? When do they typically occur?", speaker: "Doctor" },
      { text: "They usually start in the morning and get worse throughout the day.", speaker: "Patient" },
      { text: "Are you experiencing any other symptoms along with the headaches?", speaker: "Doctor" },
      { text: "I've also been feeling a bit dizzy sometimes.", speaker: "Patient" },
      { text: "How long have you been experiencing these symptoms?", speaker: "Doctor" },
      { text: "Yes, it's been going on for about two weeks now.", speaker: "Patient" },
      { text: "Have you tried any medications to alleviate the pain?", speaker: "Doctor" },
      { text: "I've tried taking over-the-counter pain medication but it doesn't help much.", speaker: "Patient" },
      { text: "Have you noticed any changes in your vision?", speaker: "Doctor" },
      { text: "No, I haven't noticed any changes in my vision.", speaker: "Patient" },
      { text: "How's your sleep? How many hours do you typically get each night?", speaker: "Doctor" },
      { text: "I usually sleep about 7 hours per night.", speaker: "Patient" },
      { text: "Have you been under any stress lately?", speaker: "Doctor" },
      { text: "I've been under a lot of stress at work lately.", speaker: "Patient" },
      { text: "What about caffeine intake? How much coffee or tea do you drink daily?", speaker: "Doctor" },
      { text: "Yes, I drink about 2-3 cups of coffee each day.", speaker: "Patient" },
      { text: "Is there any family history of migraines or similar headaches?", speaker: "Doctor" },
      { text: "No family history of migraines that I'm aware of.", speaker: "Patient" }
    ];
    
    // Add mock phrases at intervals to simulate real-time transcription
    let index = 0;
    const interval = setInterval(() => {
      if (index < mockConversation.length) {
        setTranscript(prev => [...prev, { 
          id: Date.now(), 
          text: mockConversation[index].text,
          speaker: mockConversation[index].speaker
        }]);
        index++;
      } else {
        clearInterval(interval);
        setIsRecording(false);
        setIsProcessing(false);
      }
    }, 2500);
    
    return {
      stop: () => {
        clearInterval(interval);
        console.log("Stopped mock transcription");
      }
    };
  };

  const handleRecord = async () => {
    setError(null); // Clear previous errors
    
    // Generate a unique consultation ID
    const consultationId = `consultation-${Date.now()}`;
    
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        // 1. Get Microphone Access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // 2. Setup WebSocket Connection
        const websocket = setupWebSocket(); // Call setupWebSocket first
        websocketRef.current = websocket; // Store the created websocket in the ref

        // 3. Wait for WebSocket connection to be established before setting up audio
        const MAX_RETRIES = 30; // Increased from 10 to 30
        const RETRY_DELAY_MS = 1000; // 1 second delay

        let retries = MAX_RETRIES;
        // Use the 'websocket' variable returned by setupWebSocket()
        while (websocket.readyState !== WebSocket.OPEN && retries > 0) {
          console.log(`Waiting for WebSocket connection, state: ${websocket.readyState}, retries left: ${retries}`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          retries--;
        }

        // 4. Check if connection succeeded after retries
        if (websocket.readyState !== WebSocket.OPEN) {
          console.warn("Failed to establish WebSocket connection after retries. Using mock transcription instead.");
          setError("Could not connect to transcription service. Using demo mode.");
          // Optionally stop the stream if we failed to connect
          stream.getTracks().forEach(track => track.stop());
          // Start simulation if connection fails
          simulateTranscription();
          return; // Exit the function
        }

        // 5. Setup Audio Processing (only if WebSocket connected)
        const audioProcessing = setupAudioProcessing(stream, websocket);
        audioProcessingRef.current = audioProcessing;
        
        // Also setup MediaRecorder for backup/local recording if needed
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : 'audio/webm'; // Fallback
          
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        
        // Reset audio chunks
        audioChunksRef.current = [];
        
        // Handle data available for local backup
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        // Start recording
        mediaRecorder.start();
        setIsRecording(true);
        console.log('Real-time streaming transcription started...');
        
      } catch (err) {
        console.error('Error accessing microphone or WebSocket:', err);
        setError('Could not access microphone or connect to transcription service. Please check permissions.');
        setIsRecording(false);
      }
    } else {
      setError('Audio recording is not supported by this browser.');
    }
  };

  // Handle Stop - Updated to handle WebSocket streaming
  const handleStop = () => {
    if (isRecording) {
      setIsRecording(false);
      console.log('Recording stopped explicitly...');
      
      // Stop media recorder if running
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      
      // Send end signal to WebSocket
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        // Send a specific message or close the connection gracefully
        // Option 1: Send a special binary message (e.g., empty buffer)
        // websocketRef.current.send(new ArrayBuffer(0)); 
        // Option 2: Close the WebSocket from the client side
        console.log("Closing WebSocket from client after stopping recording.");
        websocketRef.current.close(1000, "Client stopped recording"); // 1000 is normal closure
      }
      
      // Call the clean stop function from audio processing
      if (processorNodeRef.current) {
        processorNodeRef.current.disconnect();
        processorNodeRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
    }
  };

  // Handle Pause remains the same as before or can call handleStop for now
  const handlePause = () => {
    handleStop(); // For now, just stop the recording
  };

  // File upload handler remains the same for now
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      console.log('File selected:', file.name);
      // TODO: Implement file upload logic (potentially use the same /direct endpoint?)
    }
  };

  return (
    <div className="container mx-auto p-6 flex flex-col h-[calc(100vh-4rem)] gap-6 bg-gray-50">
      {/* Top Row: Patient Info, Document Upload & Controls */}
      <div className="flex flex-col md:flex-row flex-wrap gap-4">
        {/* Patient Info Section */}
        <Card className="w-full md:w-auto flex-shrink-0 border-none shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-lg text-gray-800">Patient Information</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
             <Label htmlFor="patientName" className="whitespace-nowrap font-medium text-gray-700">Name:</Label>
             <Input
               id="patientName"
               type="text"
               placeholder="Enter patient name..."
               value={patientName}
               onChange={(e) => setPatientName(e.target.value)}
               className="w-full sm:w-72 border-gray-200 focus:border-blue-500"
             />
            {/* TODO: Add more patient fields (DOB, ID, etc.) */}
          </CardContent>
        </Card>

        {/* Document Upload Card - Moved to top row */}
        <Card className="w-full md:w-auto flex-shrink-0 border-none shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-gray-800 flex items-center gap-2">
              <UploadCloud className="h-4 w-4 text-gray-600" />
              Document Upload
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 flex items-center">
            <Label
              htmlFor="documentUpload"
              className="flex flex-col items-center justify-center w-full h-12 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors px-4"
            >
              <div className="flex items-center">
                <UploadCloud className="w-5 h-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-700">Click to upload files</span>
              </div>
            </Label>
            <Input id="documentUpload" type="file" className="hidden" onChange={handleFileChange} multiple />
          </CardContent>
        </Card>

        {/* Recording Controls */}
        <Card className="w-full md:w-auto flex-grow md:flex-grow-0 md:ml-auto border-none shadow-sm">
           <CardContent className="p-4 flex flex-wrap justify-center items-center gap-3">
            {!isRecording && !isProcessing && (
                <Button onClick={handleRecord} variant="default" size="lg" className="flex-grow md:flex-grow-0 bg-blue-600 hover:bg-blue-700 text-white">
                   <Mic className="mr-2 h-5 w-5" /> Start Consultation
                </Button>
            )}
            {isRecording && (
                <>
                <Button onClick={handleStop} variant="outline" size="lg" className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300">
                    <Square className="mr-2 h-5 w-5" /> Stop & Process
                </Button>
                </>
            )}
             {isProcessing && (
                 <Button disabled size="lg" className="bg-gray-100 text-gray-500">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing Audio...
                 </Button>
            )}
           </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* Left Column: Transcript */}
        <Card className="lg:col-span-7 flex flex-col border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white p-4 pb-2 flex flex-row justify-between items-center border-b">
            <div>
              <CardTitle className="text-gray-800">Live Transcription</CardTitle>
              <CardDescription className="text-gray-500">
                  {isRecording ? "Recording in progress..." : "Start consultation to begin recording."}
              </CardDescription>
            </div>
            {analysis.severity && (
                <SeverityBadge severity={analysis.severity} />
            )}
          </CardHeader>
          <CardContent className="bg-white flex-1 p-4 overflow-auto">
            {/* Display Error Message */}
            {error && <p className="mb-4 text-sm text-red-600">Error: {error}</p>}

            {/* Display Transcript Lines */}
            {transcript.map((line) => {
              // Determine speaker number from label for consistent coloring
              let speakerIdForColor = 0;
              if (line.speaker) {
                  const match = line.speaker.match(/\d+/);
                  if (match) {
                      speakerIdForColor = parseInt(match[0], 10) - 1; // Get 0, 1, 2...
                  }
              }
              // Assign color based on speaker number (e.g., even/odd)
              const colorClass = speakerIdForColor % 2 === 0 
                  ? 'text-blue-700' 
                  : 'text-emerald-700';
                  
              return (
                  <p key={line.id} className="mb-3 text-sm leading-relaxed text-gray-800">
                  {line.speaker ? (
                      <>
                      <span className={`font-semibold ${colorClass}`}>
                          {line.speaker}:
                      </span>{' '}
                      {line.text}
                      </>
                  ) : (
                      line.text // Should not happen if backend always sends speaker
                  )}
                  </p>
              );
            })}

            {/* Display Loading/Listening Indicators */} 
            {isRecording && transcript.length === 0 && !error && (
              <p className="text-blue-600 italic mt-4">Listening...</p>
            )}
            {isProcessing && (
              <p className="text-gray-500 italic mt-4 flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Transcribing audio...
              </p>
            )}
            {!isRecording && !isProcessing && transcript.length === 0 && !error && (
              <p className="text-gray-500 italic mt-4">Transcription will appear here.</p>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Analysis Cards */}
        <div className="lg:col-span-5 flex flex-col gap-5 overflow-hidden">
          {/* Suggested Questions Card */}
          <Card className="flex flex-col flex-grow border-none shadow-sm bg-gradient-to-br from-blue-50 to-white overflow-hidden">
            <CardHeader className="p-4 pb-2 border-b border-blue-100 flex-shrink-0">
              <CardTitle className="text-blue-800 flex items-center gap-2 text-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <path d="M12 17h.01"/>
                </svg>
                Suggested Questions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-3 overflow-auto flex-grow">
              {analysis.suggestions.length > 0 ? (
                <ul className="space-y-2.5">
                {analysis.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2 text-gray-800">
                      <span className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="text-sm">{suggestion}</span>
                    </li>
                ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 italic flex items-center justify-center h-16">
                  {isRecording ? "Analyzing conversation..." : "No suggestions available yet."}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Symptoms Card */}
          <Card className="flex flex-col flex-grow border-none shadow-sm overflow-hidden">
            <CardHeader className="p-4 pb-2 border-b flex-shrink-0">
              <CardTitle className="text-gray-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                  <path d="M8 19h8a4 4 0 0 0 3.8-2.8 4 4 0 0 0-1.6-4.5c1-1.1 1-2.7 0-3.8-.7-.8-1.7-1.1-2.7-1-1-.7-2.4-.7-3.4 0-.3-.2-.7-.2-1 0-1-.7-2.4-.7-3.4 0-1-.1-2 .2-2.7 1-1 1.1-1 2.7 0 3.8a4 4 0 0 0-1.6 4.5A4 4 0 0 0 8 19Z"/>
                  <path d="M12 3v4"/>
                </svg>
                Detected Symptoms
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-3 overflow-auto bg-white flex-grow">
              {analysis.symptoms.length > 0 ? (
                <ul className="space-y-1.5">
                  {analysis.symptoms.map((symptom, index) => (
                    <li key={index} className="flex items-center gap-2 text-gray-800">
                      <span className={`h-1.5 w-1.5 rounded-full ${symptom.is_primary ? 'bg-red-500' : 'bg-gray-400'}`}></span>
                      <span className={`text-sm ${symptom.is_primary ? 'font-medium' : ''}`}>{symptom.description}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 italic flex items-center justify-center h-16">
                  {isRecording ? "Analyzing symptoms..." : "No symptoms detected yet."}
                </p>
              )}
            </CardContent>
          </Card>
          
          {/* Possible Diagnoses Card */}
          <Card className="flex flex-col flex-grow border-none shadow-sm bg-gradient-to-br from-purple-50 to-white overflow-hidden">
            <CardHeader className="p-4 pb-2 border-b border-purple-100 flex-shrink-0">
              <CardTitle className="text-purple-800 flex items-center gap-2 text-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
                  <path d="M21 2H3v4h18V2z"/>
                  <path d="M21 10H3v4h18v-4z"/>
                  <path d="M21 18H3v4h18v-4z"/>
                  <path d="M3 2v20"/>
                  <path d="M21 2v20"/>
                </svg>
                Possible Diagnoses
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-3 overflow-auto flex-grow">
              {analysis.diagnoses && analysis.diagnoses.length > 0 ? (
                <ul className="space-y-3">
                  {analysis.diagnoses.map((diagnosis, index) => {
                    // Determine color based on confidence
                    let confidenceColor = '';
                    switch (diagnosis.confidence.toLowerCase()) {
                      case 'high':
                        confidenceColor = 'bg-purple-100 text-purple-800';
                        break;
                      case 'medium':
                        confidenceColor = 'bg-blue-100 text-blue-800';
                        break;
                      case 'low':
                        confidenceColor = 'bg-gray-100 text-gray-800';
                        break;
                      default:
                        confidenceColor = 'bg-gray-100 text-gray-800';
                    }
                    
                    return (
                      <li key={index} className="p-2 bg-white rounded-md border border-gray-100">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </span>
                            <span className="text-sm font-medium text-gray-800">{diagnosis.name}</span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${confidenceColor}`}>
                            {diagnosis.confidence}
                          </span>
                        </div>
                        {diagnosis.rationale && (
                            <p className="text-xs text-gray-600 pl-8">{diagnosis.rationale}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 italic flex items-center justify-center h-16">
                  {isRecording ? "Analyzing for potential diagnoses..." : "No diagnoses available yet."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- Helper Component for Severity Badge ---
// Update props to accept the Severity object
interface SeverityBadgeProps {
  severity: Severity;
}

const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  // Handle cases where severity might not be fully populated yet
  const level = severity?.level || 'Low';
  const rationale = severity?.rationale || '';
  const severityLower = level.toLowerCase(); 

  let colorClasses = "bg-gray-100 text-gray-800"; // Default
  let IconComponent = AlertTriangle; // Default icon

  switch (severityLower) {
    case 'low':
      colorClasses = "bg-green-100 text-green-800";
      // IconComponent can remain default or be set to something neutral like Info
      IconComponent = Info;
      break;
    case 'medium':
      colorClasses = "bg-yellow-100 text-yellow-800";
      IconComponent = AlertTriangle; // Explicitly set for medium
      break;
    case 'high':
      colorClasses = "bg-orange-100 text-orange-800";
      IconComponent = AlertTriangle;
      break;
    case 'urgent':
      colorClasses = "bg-red-100 text-red-800";
      IconComponent = AlertTriangle;
      break;
  }

  return (
    <div className="group relative">
      <Badge className={`text-sm font-medium ${colorClasses} px-3 py-1.5 flex items-center gap-1.5 cursor-default`}>
        <IconComponent className="h-4 w-4" />
        <span>Severity: {level}</span>
      </Badge>
      {rationale && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs 
                      bg-gray-900 text-white text-xs rounded py-1 px-2 z-10 opacity-0 
                      group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          {rationale}
        </div>
      )}
    </div>
  );
}; 