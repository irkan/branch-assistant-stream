import React, { useState, useRef, useEffect } from 'react';

interface ChatBoxProps {
  messages: Array<{ text: string; sender: 'user' | 'assistant' }>;
  inputMessage: string;
  setInputMessage: React.Dispatch<React.SetStateAction<string>>;
  handleSendMessage: (message: string) => void;
  detectedText: string;
  isSpeaking: boolean;
  isListening: boolean;
  volume: number;
}

const ChatBox: React.FC<ChatBoxProps> = ({
  messages,
  inputMessage,
  setInputMessage,
  handleSendMessage,
  detectedText,
  isSpeaking,
  isListening,
  volume
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() !== '') {
      handleSendMessage(inputMessage);
      setInputMessage('');
    }
  };

  return (
    <>
      {/* Chat toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          padding: '10px 15px',
          background: '#0066cc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          fontSize: '14px'
        }}
      >
        {isOpen ? 'Çatı Bağla' : 'Çatı Aç'}
      </button>

      {/* Chat box container */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            right: '20px',
            width: '350px',
            height: '500px',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 0 15px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 999
          }}
        >
          {/* Chat header */}
          <div
            style={{
              padding: '15px',
              background: '#0066cc',
              color: 'white',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px' }}>ABB Virtual Köməkçi</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isListening && (
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: 'green',
                    animation: 'pulse 1.5s infinite'
                  }}
                />
              )}
              {isSpeaking && (
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: 'orange',
                    animation: 'pulse 1.5s infinite'
                  }}
                />
              )}
            </div>
          </div>

          {/* Messages area */}
          <div
            style={{
              flex: 1,
              padding: '15px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              background: '#f5f5f5'
            }}
          >
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  alignSelf: message.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  padding: '10px 15px',
                  borderRadius: message.sender === 'user' ? '18px 18px 0 18px' : '18px 18px 18px 0',
                  background: message.sender === 'user' ? '#0066cc' : 'white',
                  color: message.sender === 'user' ? 'white' : 'black',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                }}
              >
                {message.text}
              </div>
            ))}
            {isListening && detectedText && (
              <div
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '80%',
                  padding: '10px 15px',
                  borderRadius: '18px 18px 0 18px',
                  background: '#e6e6e6',
                  color: '#666',
                  fontStyle: 'italic'
                }}
              >
                {detectedText}...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              padding: '10px',
              borderTop: '1px solid #eee'
            }}
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Mesajınızı yazın..."
              style={{
                flex: 1,
                padding: '10px 15px',
                border: '1px solid #ddd',
                borderRadius: '20px',
                outline: 'none',
                fontSize: '14px'
              }}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              style={{
                marginLeft: '10px',
                background: '#0066cc',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputMessage.trim() ? 'pointer' : 'not-allowed',
                opacity: inputMessage.trim() ? 1 : 0.6
              }}
            >
              →
            </button>
          </form>

          {/* Volume indicator */}
          {isListening && (
            <div
              style={{
                position: 'absolute',
                bottom: '75px',
                width: '100%',
                padding: '0 15px',
                boxSizing: 'border-box'
              }}
            >
              <div
                style={{
                  height: '4px',
                  background: '#eee',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(volume * 2, 100)}%`,
                    background: '#0066cc',
                    transition: 'width 0.1s ease-out'
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
      `}</style>
    </>
  );
};

export default ChatBox; 