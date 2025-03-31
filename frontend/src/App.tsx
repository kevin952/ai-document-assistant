import React, { useState, useRef } from 'react';
import {
  Box,
  Container,
  TextField,
  Paper,
  Typography,
  IconButton,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  useTheme,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Fade,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Avatar,
  Chip,
} from '@mui/material';
import { Mic, MicOff, Send, Upload, CloudUpload, Add, Close, Psychology, Code, Storage, Security, Speed, Link } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import axios, { AxiosError } from 'axios';

interface Message {
  type: 'user' | 'assistant';
  content: string;
  sources?: string[];
  model?: string;
}

interface ApiError {
  detail: string;
}

interface Model {
  id: string;
  name: string;
  provider: string;
}

const AVAILABLE_MODELS: Model[] = [
  { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
  { id: 'claude-2.1', name: 'Claude 2.1', provider: 'Anthropic' },
];

// Create a dark theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#10a37f',
      light: '#1a8f6f',
      dark: '#0a7a5f',
    },
    background: {
      default: '#1a1a1a',
      paper: '#2d2d2d',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b3b3b3',
    },
    divider: 'rgba(255, 255, 255, 0.1)',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
            },
            '&:hover fieldset': {
              borderColor: '#10a37f',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#10a37f',
            },
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: '#ffffff',
            borderRadius: '12px',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
  },
});

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropzone, setShowDropzone] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4');
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const theme = useTheme();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      for (const file of acceptedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          await axios.post('http://localhost:8000/api/upload', formData);
        } catch (error) {
          console.error('Error uploading file:', error);
        }
      }
      setShowDropzone(false);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          await handleVoiceInput(base64Audio);
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const handleVoiceInput = async (audioBase64: string) => {
    setIsLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/api/query', {
        text: audioBase64,
        voice: true,
        model: selectedModel,
      });
      setMessages(prev => [...prev, {
        type: 'user',
        content: 'Voice input',
        model: selectedModel,
      }, {
        type: 'assistant',
        content: response.data.results.answer,
        sources: response.data.results.sources,
        model: selectedModel,
      }]);
    } catch (error) {
      console.error('Error processing voice input:', error);
      const axiosError = error as AxiosError<ApiError>;
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: `Error: ${axiosError.response?.data?.detail || axiosError.message}`,
        model: selectedModel,
      }]);
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    setMessages(prev => [...prev, { 
      type: 'user', 
      content: input,
      model: selectedModel 
    }]);
    setInput('');

    try {
      const response = await axios.post('http://localhost:8000/api/query', {
        text: input,
        voice: false,
        model: selectedModel,
      });
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: response.data.results.answer,
        sources: response.data.results.sources,
        model: selectedModel,
      }]);
    } catch (error) {
      console.error('Error processing query:', error);
      const axiosError = error as AxiosError<ApiError>;
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: `Error: ${axiosError.response?.data?.detail || axiosError.message}`,
        model: selectedModel,
      }]);
    }
    setIsLoading(false);
  };

  const ThinkingIndicator = () => (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 1, 
      color: 'text.secondary', 
      py: 2,
      px: 3,
      bgcolor: 'background.paper',
      borderRadius: 2,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    }}>
      <Psychology sx={{ color: 'primary.main', animation: 'pulse 2s infinite' }} />
      <Typography variant="body2">Processing your request...</Typography>
    </Box>
  );

  const formatMessage = (message: string) => {
    // Split the message into sections based on headers
    const sections = message.split(/(?=^[A-Za-z\s]+$)/m);
    
    return sections.map((section, index) => {
      const lines = section.trim().split('\n');
      const header = lines[0].trim();
      const content = lines.slice(1).join('\n');
      
      // Skip empty sections
      if (!content.trim()) return null;
      
      // Format references section
      if (header.toLowerCase().includes('reference')) {
        return (
          <Box key={index} sx={{ mt: 3 }}>
            <Typography 
              variant="subtitle2" 
              sx={{ 
                mb: 1, 
                fontWeight: 500,
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Link sx={{ fontSize: '1.2rem' }} />
              References
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {content.split('\n').map((ref, refIndex) => {
                const cleanRef = ref.replace(/^[-•]\s*/, '').trim();
                if (!cleanRef) return null;
                return (
                  <Chip
                    key={refIndex}
                    label={cleanRef}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(16, 163, 127, 0.1)',
                      color: 'primary.main',
                      '&:hover': {
                        backgroundColor: 'rgba(16, 163, 127, 0.15)',
                      },
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        );
      }
      
      // Format regular sections
      return (
        <Box key={index} sx={{ mb: 3 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              mb: 2, 
              color: 'primary.main',
              fontWeight: 600,
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              pb: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            {header === 'Answer' && <Psychology sx={{ fontSize: '1.2rem' }} />}
            {header === 'Context' && <Storage sx={{ fontSize: '1.2rem' }} />}
            {header === 'Technical Details' && <Code sx={{ fontSize: '1.2rem' }} />}
            {header === 'Functionality' && <Speed sx={{ fontSize: '1.2rem' }} />}
            {header === 'Integration' && <Link sx={{ fontSize: '1.2rem' }} />}
            {header === 'Best Practices' && <Security sx={{ fontSize: '1.2rem' }} />}
            {header}
          </Typography>
          <Box sx={{ pl: 2 }}>
            {content.split('\n').map((line, lineIndex) => {
              // Remove markdown formatting and clean the line
              const cleanLine = line.replace(/\*\*/g, '').trim();
              
              // Handle bullet points
              if (cleanLine.startsWith('-') || cleanLine.startsWith('•')) {
                return (
                  <Typography 
                    key={lineIndex} 
                    sx={{ 
                      mb: 1.5,
                      lineHeight: 1.6,
                      color: 'text.primary',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                      pl: 1,
                    }}
                  >
                    <span style={{ color: '#10a37f', fontSize: '1.2rem', lineHeight: 1 }}>•</span>
                    {cleanLine.replace(/^[-•]\s*/, '')}
                  </Typography>
                );
              }
              
              // Handle numbered lists
              if (cleanLine.match(/^\d+\./)) {
                return (
                  <Typography 
                    key={lineIndex} 
                    sx={{ 
                      mb: 1.5,
                      lineHeight: 1.6,
                      color: 'text.primary',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                      pl: 1,
                    }}
                  >
                    <span style={{ 
                      color: '#10a37f', 
                      fontSize: '1.2rem',
                      lineHeight: 1,
                      fontWeight: 600,
                      minWidth: '1.5rem'
                    }}>
                      {cleanLine.match(/^\d+/)?.[0]}
                    </span>
                    {cleanLine.replace(/^\d+\.\s*/, '')}
                  </Typography>
                );
              }
              
              // Handle regular text
              if (cleanLine) {
                return (
                  <Typography 
                    key={lineIndex} 
                    sx={{ 
                      mb: 1.5,
                      lineHeight: 1.6,
                      color: 'text.primary',
                      pl: 1,
                    }}
                  >
                    {cleanLine}
                  </Typography>
                );
              }
              
              return null;
            })}
          </Box>
        </Box>
      );
    });
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}>
        {/* Header */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            borderBottom: '1px solid',
            borderColor: 'divider',
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            backdropFilter: 'blur(10px)',
            bgcolor: 'rgba(26, 26, 26, 0.8)',
          }}
        >
          <Typography variant="h1" sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
            Company Knowledge Base
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Model</InputLabel>
              <Select
                value={selectedModel}
                label="Model"
                onChange={(e) => setSelectedModel(e.target.value)}
                sx={{ 
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                }}
              >
                {AVAILABLE_MODELS.map((model) => (
                  <MenuItem key={model.id} value={model.id}>
                    {model.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <IconButton 
              onClick={() => setShowDropzone(!showDropzone)}
              sx={{ 
                color: 'primary.main',
                '&:hover': { bgcolor: 'rgba(16, 163, 127, 0.1)' }
              }}
            >
              <Upload />
            </IconButton>
          </Box>
        </Paper>

        {/* Main content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {/* Dropzone */}
          {showDropzone && (
            <Fade in={showDropzone}>
              <Paper
                {...getRootProps()}
                sx={{
                  p: 3,
                  mb: 2,
                  textAlign: 'center',
                  cursor: 'pointer',
                  border: '2px dashed',
                  borderColor: isDragActive ? 'primary.main' : 'divider',
                  bgcolor: isDragActive ? 'rgba(16, 163, 127, 0.1)' : 'background.paper',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'rgba(16, 163, 127, 0.1)',
                  },
                }}
              >
                <input {...getInputProps()} />
                <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography variant="h6" gutterBottom>
                  {isDragActive ? 'Drop the files here' : 'Drag and drop files here'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Supported formats: PDF, DOCX, TXT, MD, PPTX
                </Typography>
              </Paper>
            </Fade>
          )}

          {/* Messages */}
          <List sx={{ width: '100%' }}>
            {messages.map((message, index) => (
              <React.Fragment key={index}>
                <ListItem
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    bgcolor: message.type === 'assistant' ? 'background.paper' : 'transparent',
                    borderRadius: 2,
                    mb: 2,
                    p: 3,
                    boxShadow: message.type === 'assistant' ? '0 4px 20px rgba(0, 0, 0, 0.1)' : 'none',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {message.type === 'user' ? 'You' : 'Assistant'}
                    </Typography>
                    {message.model && (
                      <Typography variant="caption" color="primary.main">
                        ({message.model})
                      </Typography>
                    )}
                  </Box>
                  {message.type === 'user' ? (
                    <Box sx={{ 
                      bgcolor: 'background.paper',
                      p: 3,
                      borderRadius: 2,
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}>
                      <Typography sx={{ 
                        color: 'text.primary',
                        lineHeight: 1.6,
                      }}>
                        {message.content}
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
                      <Avatar 
                        sx={{ 
                          bgcolor: 'primary.main',
                          width: 36,
                          height: 36,
                          boxShadow: '0 2px 8px rgba(16, 163, 127, 0.2)',
                        }}
                      >
                        <Psychology />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ 
                          bgcolor: 'background.paper',
                          p: 3,
                          borderRadius: 2,
                          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          border: '1px solid',
                          borderColor: 'divider',
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.15)',
                          },
                        }}>
                          {formatMessage(message.content)}
                        </Box>
                      </Box>
                    </Box>
                  )}
                  {message.sources && message.sources.length > 0 && (
                    <Box sx={{ mt: 2, width: '100%' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Sources:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {message.sources.map((source, idx) => (
                          <Paper
                            key={idx}
                            sx={{
                              px: 1.5,
                              py: 0.5,
                              bgcolor: 'rgba(16, 163, 127, 0.1)',
                              borderRadius: 1,
                            }}
                          >
                            <Typography variant="caption" color="primary.main">
                              {source}
                            </Typography>
                          </Paper>
                        ))}
                      </Box>
                    </Box>
                  )}
                </ListItem>
                {index < messages.length - 1 && <Divider sx={{ my: 2 }} />}
              </React.Fragment>
            ))}
            {isLoading && (
              <ListItem sx={{ justifyContent: 'center' }}>
                <ThinkingIndicator />
              </ListItem>
            )}
            <div ref={messagesEndRef} />
          </List>
        </Box>

        {/* Input area */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2, 
            borderTop: '1px solid',
            borderColor: 'divider',
            position: 'sticky',
            bottom: 0,
            bgcolor: 'background.default',
            backdropFilter: 'blur(10px)',
          }}
        >
          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                disabled={isLoading}
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    pr: 1,
                  },
                }}
              />
              <IconButton
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                sx={{ 
                  color: isRecording ? 'error.main' : 'primary.main',
                  '&:hover': { 
                    bgcolor: isRecording ? 'rgba(211, 47, 47, 0.1)' : 'rgba(16, 163, 127, 0.1)' 
                  }
                }}
              >
                {isRecording ? <MicOff /> : <Mic />}
              </IconButton>
              <IconButton
                type="submit"
                disabled={isLoading || !input.trim()}
                sx={{ 
                  color: 'primary.main',
                  '&:hover': { bgcolor: 'rgba(16, 163, 127, 0.1)' }
                }}
              >
                <Send />
              </IconButton>
            </Box>
          </form>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}

export default App; 