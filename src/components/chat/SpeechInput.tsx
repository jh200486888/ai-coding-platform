'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechInputProps {
  onTranscriptionChange?: (text: string) => void;
  onAudioRecorded?: (audioBlob: Blob) => Promise<string>;
  lang?: string;
  disabled?: boolean;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

type RecognitionMode = 'webspeech' | 'mediarecorder' | 'unsupported';

export function SpeechInput({
  onTranscriptionChange,
  onAudioRecorded,
  lang = 'zh-CN',
  disabled = false,
  className,
  size = 'icon',
  variant = 'ghost',
}: SpeechInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [mode, setMode] = useState<RecognitionMode>('unsupported');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      setMode('webspeech');
    } else if (typeof MediaRecorder !== 'undefined' && onAudioRecorded) {
      setMode('mediarecorder');
    } else {
      setMode('unsupported');
    }
  }, [onAudioRecorded]);

  useEffect(() => {
    return () => { cleanup(); };
  }, []);

  const cleanup = useCallback(() => {
    if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} recognitionRef.current = null; }
    if (mediaRecorderRef.current) { try { mediaRecorderRef.current.stop(); } catch {} mediaRecorderRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    chunksRef.current = [];
  }, []);

  const startWebSpeech = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR() as SpeechRecognitionInstance;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    finalTranscriptRef.current = '';
    setErrorMsg('');

    recognition.onstart = () => {
      setIsListening(true);
      setStatusText('正在聆听...');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      // Show interim results live
      const display = finalTranscriptRef.current + interim;
      setStatusText(display || '正在聆听...');
      // Send both interim and final to input
      if (interim && onTranscriptionChange) {
        onTranscriptionChange(finalTranscriptRef.current + interim);
      }
      if (finalTranscriptRef.current && onTranscriptionChange) {
        onTranscriptionChange(finalTranscriptRef.current);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech error:', event.error);
      let msg = '语音识别出错';
      if (event.error === 'network' || event.error === 'service-not-allowed') {
        msg = '语音服务不可用（可能需要科学上网）';
      } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        msg = '麦克风权限被拒绝，请在浏览器设置中允许';
      } else if (event.error === 'no-speech') {
        msg = '没有检测到语音，请重试';
      } else if (event.error === 'audio-capture') {
        msg = '麦克风设备异常';
      } else if (event.error === 'aborted') {
        msg = '';
      } else {
        msg = '语音识别失败: ' + event.error;
      }
      if (msg) {
        setErrorMsg(msg);
        setStatusText(msg);
        setTimeout(() => { setErrorMsg(''); setStatusText(''); }, 4000);
      }
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      if (!errorMsg) setStatusText('');
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setStatusText('正在启动语音识别...');
    } catch (e) {
      console.error('Failed to start:', e);
      setErrorMsg('无法启动语音识别，请检查浏览器兼容性');
      setStatusText('无法启动语音识别');
      setTimeout(() => { setErrorMsg(''); setStatusText(''); }, 3000);
    }
  }, [lang, onTranscriptionChange, errorMsg]);

  const stopWebSpeech = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setStatusText('');
  }, []);

  const startMediaRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      setErrorMsg('');

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        setIsProcessing(true);
        setStatusText('正在转写语音...');

        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }

        if (onAudioRecorded) {
          try {
            const transcript = await onAudioRecorded(audioBlob);
            if (onTranscriptionChange) onTranscriptionChange(transcript);
          } catch (e) {
            console.error('Transcription failed:', e);
            setErrorMsg('语音转写失败');
          }
        }
        setIsProcessing(false);
        setStatusText('');
        mediaRecorderRef.current = null;
      };

      mediaRecorder.start();
      setIsListening(true);
      setStatusText('正在录音...');
    } catch (e) {
      console.error('MediaRecorder failed:', e);
      setErrorMsg('无法访问麦克风');
      setStatusText('麦克风权限被拒绝');
      setTimeout(() => { setErrorMsg(''); setStatusText(''); }, 3000);
    }
  }, [onAudioRecorded, onTranscriptionChange]);

  const stopMediaRecorder = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleClick = useCallback(() => {
    if (isListening) {
      if (mode === 'webspeech') stopWebSpeech();
      else if (mode === 'mediarecorder') stopMediaRecorder();
    } else {
      if (mode === 'webspeech') startWebSpeech();
      else if (mode === 'mediarecorder') startMediaRecorder();
    }
  }, [isListening, mode, startWebSpeech, stopWebSpeech, startMediaRecorder, stopMediaRecorder]);

  const isDisabled = disabled || mode === 'unsupported' || isProcessing;

  return (
    <div className="relative inline-flex flex-col items-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        className={`relative inline-flex items-center justify-center transition-colors rounded-lg shrink-0
          ${size === 'icon' ? 'p-2' : 'px-3 py-2'}
          ${isListening ? 'text-red-400 hover:text-red-300 bg-red-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}
          ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
          ${className || ''}`}
        title={
          mode === 'unsupported'
            ? '语音识别不可用，请使用 Chrome 或 Edge 浏览器'
            : isListening ? '停止语音输入' : '语音输入'
        }
      >
        {isProcessing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isListening ? (
          <>
            <MicOff className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
          </>
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </button>
      {/* Status text shown below the button */}
      {statusText && (
        <div className={`absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] px-2 py-1 rounded-md shadow-lg
          ${errorMsg ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-card text-muted-foreground border border-border'}
          max-w-[200px] truncate z-50`}>
          {statusText}
        </div>
      )}
    </div>
  );
}
