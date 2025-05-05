'use client'

import { useState, useRef, useEffect } from 'react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle,
  Download,
  FileText,
  HelpCircle,
  Layers,
  Loader2,
  MessageSquare,
  Mic,
  Pause,
  Pencil,
  Plus,
  Share2,
  Square,
  Stethoscope,
  Wand2,
  X
} from 'lucide-react'

// UI Components
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'

// Define types for better state management
interface TranscriptLine {
  id: number;
  text: string;
  speaker?: string;
  timestamp?: string;
}

// Placeholder data - Now used as initial state only
const initialTranscript: TranscriptLine[] = [];

// Get backend URL from environment variable or default
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE_URL) {
  console.error("FATAL ERROR: NEXT_PUBLIC_API_URL is not defined. Check environment variables.");
}

// Define types for Analysis Data
interface Symptom {
  description: string;
  is_primary: boolean;
}

interface Severity {
  level: string;
  rationale: string;
}

interface Diagnosis {
  name: string;
  confidence: string;
  rationale: string;
}

interface AnalysisData {
  symptoms: Symptom[];
  suggestions: string[];
  severity: Severity;
  diagnoses: Diagnosis[];
}

// Add additional types for improved UI
interface PatientInfo {
  name: string;
  id?: string;
  age?: string;
  gender?: string;
  medicalHistory?: string;
}

// Report related interfaces
interface ReportItem {
  id: string;
  type: 'symptom' | 'diagnosis' | 'recommendation' | 'context';
  content: string;
  approved: boolean;
  isEditing?: boolean;
}

interface ReportSection {
  title: string;
  items: ReportItem[];
}

interface Report {
  patientInfo: PatientInfo;
  consultationDate: string;
  consultationDuration: string;
  sections: {
    context: ReportSection;
    symptoms: ReportSection;
    diagnoses: ReportSection;
    recommendations: ReportSection;
  };
  isApproved: boolean;
  isGenerating: boolean;
}

export default function ConsultationPage() {
  return (
    <ProtectedRoute>
      <ConsultationWorkspace />
    </ProtectedRoute>
  );
}

function ConsultationWorkspace() {
  // Core state management
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>(initialTranscript);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('live');
  
  // Enhanced patient information
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: '',
    id: '',
    age: '',
    gender: ''
  });
  
  // Analyses state with improved structure
  const [analysis, setAnalysis] = useState<AnalysisData>({
    symptoms: [],
    suggestions: [],
    severity: { level: "Low", rationale: "" },
    diagnoses: []
  });
  
  // UI state management
  const [showMobileTranscript, setShowMobileTranscript] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Report state
  const [report, setReport] = useState<Report | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  // Refs for audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const audioProcessingRef = useRef<{audioContext: AudioContext | null, stopProcessing: () => void} | null>(null);
  const currentLineIdRef = useRef<number>(0);
  const recordingTimerRef = useRef<number | null>(null);
  
  // After recording stops, automatically switch to analysis tab
  useEffect(() => {
    if (!isRecording && transcript.length > 0) {
      setActiveTab('analysis');
    }
  }, [isRecording, transcript.length]);
  
  // Generate report from current analysis and transcript
  const generateReport = () => {
    if (transcript.length === 0 || isRecording) {
      setError("Cannot generate report while recording or with no transcript data");
      return;
    }
    
    setIsGeneratingReport(true);
    
    try {
      // Create a new report based on current data
      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      // Create a more meaningful consultation summary instead of using raw transcript
      let consultationSummary = "";
      
      // Find symptoms mentioned in transcript to create a better summary
      if (analysis.symptoms.length > 0) {
        const primarySymptoms = analysis.symptoms
          .filter(s => s.is_primary)
          .map(s => s.description.toLowerCase());
          
        if (primarySymptoms.length > 0) {
          consultationSummary = `Patient consultation regarding ${primarySymptoms.join(', ')}.`;
        } else {
          consultationSummary = `Patient consultation regarding ${analysis.symptoms[0].description.toLowerCase()}.`;
        }
      } else if (transcript.length > 10) {
        // If we have transcript but no symptoms were identified, create a generic summary
        consultationSummary = "Patient consultation for medical evaluation and advice.";
      } else {
        consultationSummary = "Brief patient consultation.";
      }
      
      // Generate detailed recommendations based on diagnoses and symptoms
      const recommendations: ReportItem[] = [];
      
      // Generate recommendations based on diagnoses if available
      if (analysis.diagnoses.length > 0) {
        // Primary diagnosis recommendation
        const primaryDiagnosis = analysis.diagnoses[0];
        
        // Add recommendation for diagnostic confirmation
        recommendations.push({
          id: `rec-test-${Date.now()}`,
          type: 'recommendation',
          content: `Schedule the following diagnostic tests to confirm ${primaryDiagnosis.name}: complete blood count (CBC), comprehensive metabolic panel, and relevant imaging studies.`,
          approved: false
        });
        
        // Add medication recommendation
        recommendations.push({
          id: `rec-med-${Date.now()}`,
          type: 'recommendation',
          content: `Consider appropriate medication based on confirmed diagnosis. If ${primaryDiagnosis.name} is confirmed, standard treatment protocol should be followed.`,
          approved: false
        });
        
        // Add follow-up recommendation
        recommendations.push({
          id: `rec-followup-${Date.now()}`,
          type: 'recommendation',
          content: `Schedule follow-up appointment in 2 weeks to assess response to treatment and review test results.`,
          approved: false
        });
      } else if (analysis.symptoms.length > 0) {
        // If no diagnoses but we have symptoms, create symptom-based recommendations
        recommendations.push({
          id: `rec-symptom-${Date.now()}`,
          type: 'recommendation',
          content: `Conduct baseline diagnostic tests including CBC and metabolic panel to evaluate symptoms further.`,
          approved: false
        });
        
        recommendations.push({
          id: `rec-monitor-${Date.now()}`,
          type: 'recommendation',
          content: `Patient advised to monitor symptoms and maintain detailed symptom diary.`,
          approved: false
        });
        
        recommendations.push({
          id: `rec-followup-${Date.now()}`,
          type: 'recommendation',
          content: `Schedule follow-up within 7-10 days for reassessment.`,
          approved: false
        });
      }
      
      // Default recommendation if none available
      if (recommendations.length === 0) {
        recommendations.push({
          id: `rec-${Date.now()}`,
          type: 'recommendation',
          content: 'Routine follow-up with the patient within 2 weeks to monitor symptoms and general health status.',
          approved: false
        });
      }
      
      // Get symptoms from analysis
      const symptomItems: ReportItem[] = analysis.symptoms.map((symptom, index) => ({
        id: `sym-${index}-${Date.now()}`,
        type: 'symptom',
        content: symptom.description,
        approved: false
      }));
      
      // Get diagnoses from analysis
      const diagnosisItems: ReportItem[] = analysis.diagnoses.map((diag, index) => ({
        id: `diag-${index}-${Date.now()}`,
        type: 'diagnosis',
        content: `${diag.name} - ${diag.confidence} confidence. ${diag.rationale}`,
        approved: false
      }));
      
      // Create context items from transcript patterns
      const contextItems: ReportItem[] = [
        {
          id: `ctx-summary-${Date.now()}`,
          type: 'context',
          content: consultationSummary,
          approved: false
        }
      ];
      
      if (analysis.severity && analysis.severity.level !== 'Low') {
        contextItems.push({
          id: `ctx-severity-${Date.now()}`,
          type: 'context',
          content: `This case has been assessed as ${analysis.severity.level} severity. ${analysis.severity.rationale}`,
          approved: false
        });
      }
      
      // Create the report object
      const newReport: Report = {
        patientInfo: { ...patientInfo },
        consultationDate: formattedDate,
        consultationDuration: formatRecordingTime(recordingDuration),
        sections: {
          context: {
            title: "Consultation Context",
            items: contextItems
          },
          symptoms: {
            title: "Reported Symptoms",
            items: symptomItems
          },
          diagnoses: {
            title: "Potential Diagnoses",
            items: diagnosisItems
          },
          recommendations: {
            title: "Recommendations",
            items: recommendations
          }
        },
        isApproved: false,
        isGenerating: false
      };
      
      // Update the report state
      setReport(newReport);
      // Switch to report tab
      setActiveTab('report');
    } catch (err) {
      console.error("Error generating report:", err);
      setError("Failed to generate report, please try again");
    } finally {
      setIsGeneratingReport(false);
    }
  };
  
  // Toggle approval status of a report item
  const toggleReportItemApproval = (sectionKey: keyof Report['sections'], itemId: string) => {
    if (!report) return;
    
    setReport((prevReport) => {
      if (!prevReport) return null;
      
      const updatedSections = { ...prevReport.sections };
      const section = updatedSections[sectionKey];
      
      const updatedItems = section.items.map(item => 
        item.id === itemId ? { ...item, approved: !item.approved } : item
      );
      
      updatedSections[sectionKey] = {
        ...section,
        items: updatedItems
      };
      
      return {
        ...prevReport,
        sections: updatedSections
      };
    });
  };
  
  // Edit a report item
  const updateReportItem = (sectionKey: keyof Report['sections'], itemId: string, newContent: string) => {
    if (!report) return;
    
    setReport((prevReport) => {
      if (!prevReport) return null;
      
      const updatedSections = { ...prevReport.sections };
      const section = updatedSections[sectionKey];
      
      const updatedItems = section.items.map(item => 
        item.id === itemId ? { ...item, content: newContent, isEditing: false } : item
      );
      
      updatedSections[sectionKey] = {
        ...section,
        items: updatedItems
      };
      
      return {
        ...prevReport,
        sections: updatedSections
      };
    });
  };
  
  // Toggle editing mode for a report item
  const toggleItemEditing = (sectionKey: keyof Report['sections'], itemId: string) => {
    if (!report) return;
    
    setReport((prevReport) => {
      if (!prevReport) return null;
      
      const updatedSections = { ...prevReport.sections };
      const section = updatedSections[sectionKey];
      
      const updatedItems = section.items.map(item => 
        item.id === itemId ? { ...item, isEditing: !item.isEditing } : item
      );
      
      updatedSections[sectionKey] = {
        ...section,
        items: updatedItems
      };
      
      return {
        ...prevReport,
        sections: updatedSections
      };
    });
  };
  
  // Export report as PDF
  const exportReportAsPDF = () => {
    alert("PDF export functionality would be implemented here.");
    // This would typically involve:
    // 1. Formatting the report data
    // 2. Using a library like jsPDF to generate a PDF
    // 3. Triggering a download of the generated PDF
  };
  
  // Share report
  const shareReport = () => {
    alert("Share functionality would be implemented here.");
    // This would typically involve:
    // 1. Generate a shareable link or email content
    // 2. Using the Web Share API or a custom sharing UI
  };
  
  // Finalize the report
  const finalizeReport = () => {
    if (!report) return;
    
    // Count approved items
    let approvedCount = 0;
    let totalItems = 0;
    
    Object.values(report.sections).forEach(section => {
      section.items.forEach(item => {
        totalItems++;
        if (item.approved) approvedCount++;
      });
    });
    
    // Show warning if not all items are approved
    if (approvedCount < totalItems) {
      if (!confirm(`Only ${approvedCount} of ${totalItems} items are approved. Are you sure you want to finalize the report?`)) {
        return;
      }
    }
    
    // Set report as approved
    setReport(prevReport => {
      if (!prevReport) return null;
      
      return {
        ...prevReport,
        isApproved: true
      };
    });
    
    // Show success message
    alert("Report has been finalized and saved.");
    
    // In a real implementation, you would also:
    // 1. Save the report to the database
    // 2. Generate a PDF automatically
    // 3. Add it to the patient's record
    // 4. Potentially send it to relevant parties
  };
  
  // Add useEffect to log API_BASE_URL in the browser
  useEffect(() => {
    console.log('BROWSER CHECK - API_BASE_URL:', API_BASE_URL);
  }, []);
  
  // Recording timer effect
  useEffect(() => {
    if (isRecording) {
      // Start timer for recording duration
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      // Clear timer when not recording
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
    
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  // Update patient info handler
  const updatePatientInfo = (field: keyof PatientInfo, value: string) => {
    setPatientInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Format recording time as mm:ss
  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine WebSocket URL based on the API base URL
  const getWebSocketUrl = () => {
    if (!API_BASE_URL) {
      console.error("Cannot determine WebSocket URL because API_BASE_URL is not set.");
      return null;
    }
    const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${API_BASE_URL.replace(/^https?:\/\//, '')}/ws/transcribe`;
    console.log(`Calculated WebSocket URL: ${wsUrl}`);
    return wsUrl;
  };

  // Speaker text extraction helpers
  const extractSpeakerFromText = (text: string): string | undefined => {
    const match = text.match(/^(Speaker \d+):/);
    return match ? match[1] : undefined;
  };

  const removeSpeakerPrefix = (text: string): string => {
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
      
      // Clear timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, []);

  // Setup WebSocket connection with retry logic
  const setupWebSocket = (): WebSocket => {
    // Close existing connection if there is one
    if (websocketRef.current) {
      try {
        websocketRef.current.close();
      } catch (error) {
        console.error("Error closing existing WebSocket connection:", error);
      }
    }

    // Get the WebSocket URL using the helper function
    const wsUrl = getWebSocketUrl();

    if (!wsUrl) {
        const errorMsg = "Cannot setup WebSocket: API_BASE_URL is not configured.";
        console.error(errorMsg);
        setError(errorMsg);
        throw new Error(errorMsg);
    }

    console.log(`Attempting WebSocket connection to backend at ${wsUrl}`);

    try {
      const newWs = new WebSocket(wsUrl);
      
      newWs.onopen = () => {
        console.log("WebSocket connection established");
        setError(null);
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
          console.log("Received WebSocket message:", data);
          
          if (data.type === "transcript") {
            // Use the received speaker number (defaulting to 0 if missing)
            const speakerNumber = typeof data.speaker === 'number' ? data.speaker : 0;
            // Create a display label (e.g., "Speaker 1", "Speaker 2")
            const speakerLabel = `Speaker ${speakerNumber + 1}`;
            
            setTranscript(prev => [...prev, { 
              id: Date.now(), 
              text: data.text,
              speaker: speakerLabel,
              timestamp: new Date().toISOString()
            }]);
          } else if (data.type === "analysis") {
            // Handle analysis data from backend
            if (data.data && typeof data.data === 'object') {
               console.log("Received analysis data:", data.data);
               // Update state with received analysis, providing defaults for new structure
               setAnalysis({
                   symptoms: data.data.symptoms || [],
                   suggestions: data.data.suggestions || [],
                   severity: data.data.severity || { level: "Low", rationale: "" },
                   diagnoses: data.data.diagnoses || []
               });
            } else {
                console.warn("Received analysis message with invalid data structure:", data);
            }
          } else if (data.type === "error") {
            // Handle error messages from backend/Deepgram
            console.error("Received error message:", data.message);
            setError(`Error: ${data.message}`);
          } else if (data.status === "ready" || data.type === "status") {
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
              speaker: speaker,
              timestamp: new Date().toISOString()
            }]);
          } else if (data.text) {
            // Fallback for other text formats
            console.log("Received text data:", data.text);
            
            // Check if data has speaker info
            const speaker = data.speaker || extractSpeakerFromText(data.text);
            
            setTranscript(prev => [...prev, { 
              id: Date.now(), 
              text: removeSpeakerPrefix(data.text), 
              speaker: speaker,
              timestamp: new Date().toISOString()
            }]);
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };
      
      newWs.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("WebSocket connection error. Please ensure the backend server is running and reachable.");
      };
      
      newWs.onclose = (event) => {
        console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}, Was Clean: ${event.wasClean}`);
        if (!event.wasClean) {
          setError("WebSocket connection closed unexpectedly.");
        }
      };
      
      websocketRef.current = newWs;
      return newWs;
    } catch (error: any) {
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
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
            }
            
            // Send the raw PCM data (Int16Array) directly as binary
            if (websocket.bufferedAmount < recorderBufferSize * 2) {
                websocket.send(pcmData.buffer);
            } else {
                console.warn("WebSocket buffer full, dropping audio chunk");
            }
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
    ];
    
    // Add mock phrases at intervals to simulate real-time transcription
    let index = 0;
    const interval = setInterval(() => {
      if (index < mockConversation.length) {
        setTranscript(prev => [...prev, { 
          id: Date.now(), 
          text: mockConversation[index].text,
          speaker: mockConversation[index].speaker,
          timestamp: new Date().toISOString()
        }]);
        index++;
      } else {
        clearInterval(interval);
        setIsRecording(false);
        setIsProcessing(false);
        setRecordingDuration(0);
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
    setError(null);
    setRecordingDuration(0);
    
    // Generate a unique consultation ID
    const consultationId = `consultation-${Date.now()}`;
    
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        // 1. Get Microphone Access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // 2. Setup WebSocket Connection
        const websocket = setupWebSocket();
        websocketRef.current = websocket;

        // 3. Wait for WebSocket connection to be established
        const MAX_RETRIES = 30;
        const RETRY_DELAY_MS = 1000;

        let retries = MAX_RETRIES;
        while (websocket.readyState !== WebSocket.OPEN && retries > 0) {
          console.log(`Waiting for WebSocket connection, state: ${websocket.readyState}, retries left: ${retries}`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          retries--;
        }

        // 4. Check if connection succeeded after retries
        if (websocket.readyState !== WebSocket.OPEN) {
          console.warn("Failed to establish WebSocket connection after retries. Using mock transcription instead.");
          setError("Could not connect to transcription service. Using demo mode.");
          stream.getTracks().forEach(track => track.stop());
          simulateTranscription();
          setIsRecording(true);
          return;
        }

        // 5. Setup Audio Processing
        const audioProcessing = setupAudioProcessing(stream, websocket);
        audioProcessingRef.current = audioProcessing;
        
        // Setup MediaRecorder for backup
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : 'audio/webm';
          
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        
        // Reset audio chunks
        audioChunksRef.current = [];
        
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
      
      // Close WebSocket connection
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        console.log("Closing WebSocket from client after stopping recording.");
        websocketRef.current.close(1000, "Client stopped recording");
      }
      
      // Cleanup audio processing
      if (processorNodeRef.current) {
        processorNodeRef.current.disconnect();
        processorNodeRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
      
      // Reset recording duration timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      // Switch to analysis tab after stopping
      setActiveTab('analysis');
      
      // Set a brief processing state to indicate analysis completion
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        // Show a message indicating that a report can be generated
        console.log("Analysis complete. Ready to generate report!");
      }, 1500);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header with Recording Controls */}
      <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Stethoscope className="h-5 w-5 text-primary" />
            <h1 className="font-medium">Consultation Workspace</h1>
            {isRecording && (
              <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-200 animate-pulse">
                <span className="mr-1 h-2 w-2 rounded-full bg-red-500"></span>
                Recording {formatRecordingTime(recordingDuration)}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {!isRecording && !isProcessing && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      onClick={handleRecord} 
                      size="sm" 
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Mic className="mr-2 h-4 w-4" /> Start Recording
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Start recording the consultation</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {isRecording && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      onClick={handleStop} 
                      size="sm" 
                      variant="destructive"
                    >
                      <Square className="mr-2 h-4 w-4" /> End Recording
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Stop recording and analyze data</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {isProcessing && (
              <Button disabled size="sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
              </Button>
            )}
          </div>
        </div>
      </header>
      
      <main className="flex-1 container py-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left sidebar - Patient Info */}
          <div className="md:col-span-3 space-y-4">
            {/* Patient Information Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">P</AvatarFallback>
                  </Avatar>
                  Patient Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="space-y-1.5">
                  <Label htmlFor="patientName">Name</Label>
                  <Input
                    id="patientName"
                    value={patientInfo.name}
                    onChange={(e) => updatePatientInfo('name', e.target.value)}
                    placeholder="Patient name"
                    className="h-8"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="patientId">Patient ID</Label>
                  <Input
                    id="patientId"
                    value={patientInfo.id || ''}
                    onChange={(e) => updatePatientInfo('id', e.target.value)}
                    placeholder="Optional ID"
                    className="h-8"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="patientAge">Age</Label>
                    <Input
                      id="patientAge"
                      value={patientInfo.age || ''}
                      onChange={(e) => updatePatientInfo('age', e.target.value)}
                      placeholder="Age"
                      className="h-8"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="patientGender">Gender</Label>
                    <Select 
                      value={patientInfo.gender || ''} 
                      onValueChange={(value: string) => updatePatientInfo('gender', value)}
                    >
                      <SelectTrigger id="patientGender" className="h-8">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Display errors if any */}
            {error && (
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2 text-destructive rounded-md bg-destructive/10 p-2 text-xs">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p>{error}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Main content area - Tabs & Analysis */}
          <div className="md:col-span-9">
            {/* Severity Alert - Only shown if detected */}
            {analysis.severity && analysis.severity.level.toLowerCase() !== 'low' && (
              <div className="mb-4">
                <SeverityBadge severity={analysis.severity} />
              </div>
            )}
            
            <Tabs defaultValue="live" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="live" className="flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" />
                    <span>Live Transcript</span>
                  </TabsTrigger>
                  <TabsTrigger value="analysis" className="flex items-center gap-1">
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Analysis</span>
                  </TabsTrigger>
                  <TabsTrigger value="report" className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Report</span>
                  </TabsTrigger>
                </TabsList>
                
                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                          <Download className="h-4 w-4" />
                          <span className="sr-only">Download</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Download consultation data</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                          <Share2 className="h-4 w-4" />
                          <span className="sr-only">Share</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Share consultation</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              
              {/* Transcript Tab */}
              <TabsContent value="live" className="space-y-4 animate-in fade-in-50">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Live Transcription</CardTitle>
                    <CardDescription>
                      {isRecording 
                        ? "Recording in progress... Transcription will appear below."
                        : transcript.length > 0 
                          ? "Transcription of the consultation."
                          : "Start recording to begin consultation."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[calc(80vh-250px)] pr-4">
                      {transcript.length > 0 ? (
                        <div className="space-y-4">
                          {transcript.map((line) => {
                            // Determine speaker for styling
                            let speakerIdForColor = 0;
                            if (line.speaker) {
                                const match = line.speaker.match(/\d+/);
                                if (match) {
                                    speakerIdForColor = parseInt(match[0], 10) - 1;
                                }
                            }
                            
                            // Color based on speaker role
                            const isDoctor = speakerIdForColor % 2 === 0 || line.speaker === 'Doctor';
                            const speakerColor = isDoctor ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary-foreground';
                            const avatarColor = isDoctor ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary-foreground';
                            const speakerLetter = isDoctor ? 'D' : 'P';
                            
                            return (
                              <div key={line.id} className="flex items-start gap-3 group">
                                <Avatar className="h-8 w-8 mt-0.5">
                                  <AvatarFallback className={`text-xs ${avatarColor}`}>
                                    {speakerLetter}
                                  </AvatarFallback>
                                </Avatar>
                                
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium px-2 py-0.5 rounded ${speakerColor}`}>
                                      {line.speaker || 'Speaker'}
                                    </span>
                                    {line.timestamp && (
                                      <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                        {new Date(line.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm">{line.text}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[300px] text-center p-8">
                          <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
                          <h3 className="text-xl font-medium text-muted-foreground mb-1">No transcription yet</h3>
                          <p className="text-sm text-muted-foreground/70 max-w-md">
                            Click the "Start Recording" button to begin capturing 
                            the consultation. The transcription will appear here in real-time.
                          </p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Analysis Tab */}
              <TabsContent value="analysis" className="space-y-6 animate-in fade-in-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Symptoms Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="h-4 w-4 text-destructive" />
                        Detected Symptoms
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[calc(40vh-100px)] pr-4">
                        {analysis.symptoms.length > 0 ? (
                          <div className="space-y-2 pt-1">
                            {analysis.symptoms.map((symptom, index) => (
                              <div key={index} className="flex items-start gap-2.5 group">
                                <span className="flex-shrink-0 h-5 w-5 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mt-0.5">
                                  <span 
                                    className={`h-2.5 w-2.5 rounded-full ${
                                      symptom.is_primary ? 'bg-destructive' : 'bg-orange-300'
                                    }`}>
                                  </span>
                                </span>
                                <div className="flex-1">
                                  <div 
                                    className="text-sm"
                                    contentEditable={!isRecording && !isProcessing}
                                    suppressContentEditableWarning={true}
                                    onBlur={(e) => {
                                      const newSymptoms = [...analysis.symptoms];
                                      newSymptoms[index] = {
                                        ...symptom,
                                        description: e.target.innerText
                                      };
                                      setAnalysis({...analysis, symptoms: newSymptoms});
                                    }}
                                  >
                                    {symptom.description}
                                  </div>
                                  <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs px-1.5 ${symptom.is_primary ? 'border-destructive/50 text-destructive' : 'border-orange-200 text-orange-700'}`}
                                    >
                                      {symptom.is_primary ? 'Primary' : 'Secondary'}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-[200px] text-center py-6">
                            <p className="text-sm text-muted-foreground">
                              {isRecording 
                                ? "Analyzing for symptoms..." 
                                : "No symptoms detected yet."}
                            </p>
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                  
                  {/* Questions Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <HelpCircle className="h-4 w-4 text-primary" />
                        Suggested Questions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[calc(40vh-100px)] pr-4">
                        {analysis.suggestions.length > 0 ? (
                          <ul className="space-y-2 pt-1">
                            {analysis.suggestions.map((suggestion, index) => (
                              <li key={index} className="flex items-start gap-2.5">
                                <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium mt-0.5">
                                  {index + 1}
                                </span>
                                <p className="text-sm flex-1">{suggestion}</p>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-[200px] text-center py-6">
                            <p className="text-sm text-muted-foreground">
                              {isRecording 
                                ? "Generating question suggestions..." 
                                : "No questions suggested yet."}
                            </p>
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Diagnoses Card */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="h-4 w-4 text-purple-600" />
                      Possible Diagnoses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[calc(40vh-100px)] pr-4">
                      {analysis.diagnoses && analysis.diagnoses.length > 0 ? (
                        <div className="space-y-3 pt-1">
                          {analysis.diagnoses.map((diagnosis, index) => {
                            // Get confidence styling
                            let confidenceBadge = '';
                            switch (diagnosis.confidence.toLowerCase()) {
                              case 'high':
                                confidenceBadge = 'bg-purple-50 text-purple-700 border-purple-200';
                                break;
                              case 'medium':
                                confidenceBadge = 'bg-blue-50 text-blue-700 border-blue-200';
                                break;
                              case 'low':
                                confidenceBadge = 'bg-gray-50 text-gray-700 border-gray-200';
                                break;
                              default:
                                confidenceBadge = 'bg-gray-50 text-gray-700 border-gray-200';
                            }
                            
                            return (
                              <div key={index} className="p-3 rounded-lg border bg-card/50">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center text-xs font-medium">
                                      {index + 1}
                                    </span>
                                    <span 
                                      className="text-sm font-medium"
                                      contentEditable={!isRecording && !isProcessing}
                                      suppressContentEditableWarning={true}
                                      onBlur={(e) => {
                                        const newDiagnoses = [...analysis.diagnoses];
                                        newDiagnoses[index] = {
                                          ...diagnosis,
                                          name: e.target.innerText
                                        };
                                        setAnalysis({...analysis, diagnoses: newDiagnoses});
                                      }}
                                    >
                                      {diagnosis.name}
                                    </span>
                                  </div>
                                  <Badge variant="outline" className={`text-xs ${confidenceBadge}`}>
                                    {diagnosis.confidence} confidence
                                  </Badge>
                                </div>
                                {diagnosis.rationale && (
                                  <p 
                                    className="text-xs text-muted-foreground pl-8"
                                    contentEditable={!isRecording && !isProcessing}
                                    suppressContentEditableWarning={true}
                                    onBlur={(e) => {
                                      const newDiagnoses = [...analysis.diagnoses];
                                      newDiagnoses[index] = {
                                        ...diagnosis,
                                        rationale: e.target.innerText
                                      };
                                      setAnalysis({...analysis, diagnoses: newDiagnoses});
                                    }}
                                  >
                                    {diagnosis.rationale}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[200px] text-center py-6">
                          <p className="text-sm text-muted-foreground">
                            {isRecording 
                              ? "Analyzing for potential diagnoses..." 
                              : "No diagnoses available yet."}
                          </p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Report Tab */}
              <TabsContent value="report" className="animate-in fade-in-50">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Consultation Report</CardTitle>
                    <CardDescription>
                      Generate a structured report from this consultation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!report ? (
                      <div className="py-8 flex flex-col items-center justify-center space-y-4">
                        <div className="rounded-full p-3 bg-primary/10">
                          <Wand2 className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-xl font-medium">Generate Report</h3>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                          Create a structured medical consultation report based on the transcript and analysis.
                          The report will include key findings, diagnoses, and follow-up recommendations.
                        </p>
                        <Button 
                          onClick={generateReport} 
                          disabled={isRecording || isGeneratingReport || transcript.length === 0}
                          className="mt-2"
                        >
                          {isGeneratingReport ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                            </>
                          ) : (
                            <>
                              <FileText className="mr-2 h-4 w-4" /> Generate Report
                            </>
                          )}
                        </Button>
                        {(isRecording || transcript.length === 0) && (
                          <p className="text-xs text-muted-foreground">
                            {isRecording 
                              ? "Please stop recording before generating a report" 
                              : "Record a consultation first to generate a report"}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Report Header with Patient Info */}
                        <div className="p-4 rounded-lg border">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-medium">
                                  {report.patientInfo.name ? report.patientInfo.name : "Unnamed Patient"}
                                </h3>
                                {report.isApproved && (
                                  <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200">
                                    Finalized
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                                {report.patientInfo.id && (
                                  <span>ID: {report.patientInfo.id}</span>
                                )}
                                {report.patientInfo.age && (
                                  <span>Age: {report.patientInfo.age}</span>
                                )}
                                {report.patientInfo.gender && (
                                  <span>Gender: {report.patientInfo.gender}</span>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div>
                                <span className="text-muted-foreground">Date: </span>
                                <span>{report.consultationDate}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Duration: </span>
                                <span>{report.consultationDuration}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Report Sections */}
                        <ScrollArea className="h-[calc(80vh-350px)]">
                          <div className="space-y-6 pr-4">
                            {/* Context Section */}
                            <ReportSectionCard
                              section={report.sections.context}
                              sectionKey="context"
                              toggleApproval={toggleReportItemApproval}
                              updateItem={updateReportItem}
                              toggleEditing={toggleItemEditing}
                            />
                            
                            {/* Symptoms Section */}
                            <ReportSectionCard
                              section={report.sections.symptoms}
                              sectionKey="symptoms"
                              toggleApproval={toggleReportItemApproval}
                              updateItem={updateReportItem}
                              toggleEditing={toggleItemEditing}
                            />
                            
                            {/* Diagnoses Section */}
                            <ReportSectionCard
                              section={report.sections.diagnoses}
                              sectionKey="diagnoses"
                              toggleApproval={toggleReportItemApproval}
                              updateItem={updateReportItem}
                              toggleEditing={toggleItemEditing}
                            />
                            
                            {/* Recommendations Section */}
                            <ReportSectionCard
                              section={report.sections.recommendations}
                              sectionKey="recommendations"
                              toggleApproval={toggleReportItemApproval}
                              updateItem={updateReportItem}
                              toggleEditing={toggleItemEditing}
                            />
                          </div>
                        </ScrollArea>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-4 mt-2 border-t">
                          {!report.isApproved ? (
                            <>
                              <Button 
                                variant="ghost" 
                                onClick={() => setReport(null)}
                                size="sm"
                              >
                                <X className="mr-2 h-4 w-4" /> Discard
                              </Button>
                              
                              <div className="flex gap-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={shareReport}
                                >
                                  <Share2 className="mr-2 h-4 w-4" /> Share
                                </Button>
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={exportReportAsPDF}
                                >
                                  <Download className="mr-2 h-4 w-4" /> Export PDF
                                </Button>
                                
                                <Button
                                  size="sm"
                                  onClick={finalizeReport}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" /> Finalize Report
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-muted-foreground flex items-center">
                                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                                Report finalized successfully
                              </p>
                              
                              <div className="flex gap-3">
                                <Button
                                  size="sm"
                                  onClick={shareReport}
                                >
                                  <Share2 className="mr-2 h-4 w-4" /> Share
                                </Button>
                                
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={exportReportAsPDF}
                                >
                                  <Download className="mr-2 h-4 w-4" /> Download PDF
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}

// --- Helper Component for Severity Badge ---
interface SeverityBadgeProps {
  severity: Severity;
}

const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  // Handle cases where severity might not be fully populated yet
  const level = severity?.level || 'Low';
  const rationale = severity?.rationale || '';
  const severityLower = level.toLowerCase(); 

  let iconVariant: React.ReactNode;
  let badgeVariant: "default" | "destructive" | "outline" | "secondary" = "default";
  
  switch (severityLower) {
    case 'low':
      badgeVariant = "outline";
      iconVariant = (
        <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center mr-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-green-600">
            <path d="M8 12.5L10.5 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>
      );
      break;
    case 'medium':
      badgeVariant = "secondary";
      iconVariant = (
        <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center mr-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-amber-600">
            <path d="M12 9V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 17.01L12.01 16.999" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>
      );
      break;
    case 'high':
      badgeVariant = "default";
      iconVariant = (
        <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center mr-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-orange-600">
            <path d="M12 9V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 17.01L12.01 16.999" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M10.7676 3.05071L2.45825 17.2507C1.73807 18.5393 2.67174 20.1 4.19063 20.1H19.8094C21.3283 20.1 22.2619 18.5393 21.5418 17.2507L13.2324 3.05071C12.5224 1.78424 11.4776 1.78424 10.7676 3.05071Z" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>
      );
      break;
    case 'urgent':
      badgeVariant = "destructive";
      iconVariant = (
        <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center mr-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-red-600">
            <path d="M12 9V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 17.01L12.01 16.999" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M10.7676 3.05071L2.45825 17.2507C1.73807 18.5393 2.67174 20.1 4.19063 20.1H19.8094C21.3283 20.1 22.2619 18.5393 21.5418 17.2507L13.2324 3.05071C12.5224 1.78424 11.4776 1.78424 10.7676 3.05071Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.2"/>
          </svg>
        </div>
      );
      break;
    default:
      badgeVariant = "outline";
      iconVariant = (
        <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center mr-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-600">
            <path d="M12 9V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 17.01L12.01 16.999" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>
      );
  }

  return (
    <div className="w-full">
      <div className={`rounded-lg p-3 flex items-center ${
        severityLower === 'urgent' ? 'bg-red-50 border border-red-200' : 
        severityLower === 'high' ? 'bg-orange-50 border border-orange-200' :
        severityLower === 'medium' ? 'bg-amber-50 border border-amber-200' :
        'bg-green-50 border border-green-200'
      }`}>
        {iconVariant}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1">
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{level} Severity</span>
          </div>
          {rationale && (
            <span className="text-sm opacity-90 sm:ml-2 text-muted-foreground">{rationale}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// Report Section Card Component
interface ReportSectionCardProps {
  section: ReportSection;
  sectionKey: keyof Report['sections'];
  toggleApproval: (sectionKey: keyof Report['sections'], itemId: string) => void;
  updateItem: (sectionKey: keyof Report['sections'], itemId: string, newContent: string) => void;
  toggleEditing: (sectionKey: keyof Report['sections'], itemId: string) => void;
}

const ReportSectionCard: React.FC<ReportSectionCardProps> = ({ 
  section, 
  sectionKey, 
  toggleApproval, 
  updateItem,
  toggleEditing
}) => {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">{section.title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {section.items.length > 0 ? (
          <div className="space-y-3">
            {section.items.map((item) => (
              <div key={item.id} className="group">
                <div className="flex items-start gap-2 p-2 rounded-md border bg-card hover:bg-accent/5">
                  <div className="flex-shrink-0 pt-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-5 w-5 rounded-full ${
                        item.approved ? 'bg-green-100 text-green-700 hover:bg-green-200 hover:text-green-800' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                      onClick={() => toggleApproval(sectionKey, item.id)}
                    >
                      {item.approved ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <span className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <div className="flex-1">
                    {item.isEditing ? (
                      <div className="space-y-2">
                        <Input
                          defaultValue={item.content}
                          className="h-auto text-sm py-2"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateItem(sectionKey, item.id, e.currentTarget.value);
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => toggleEditing(sectionKey, item.id)}
                          >
                            Cancel
                          </Button>
                          <Button 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={(e) => {
                              const input = e.currentTarget.parentElement?.previousElementSibling as HTMLInputElement;
                              if (input) {
                                updateItem(sectionKey, item.id, input.value);
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <p className="text-sm">{item.content}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 ml-auto sm:ml-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => toggleEditing(sectionKey, item.id)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">No items in this section.</p>
        )}
      </CardContent>
    </Card>
  );
}; 