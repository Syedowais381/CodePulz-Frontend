import React, { useState, useEffect, useRef } from 'react';
import Editor from "@monaco-editor/react";

const languages = [
  { id: 'java', name: 'Java' },
  { id: 'python', name: 'Python' },
  { id: 'cpp', name: 'C++' }
];

const defaultCode = {
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World!");
        System.out.println("Enter a number:");
        java.util.Scanner sc = new java.util.Scanner(System.in);
        int n = sc.nextInt();
        System.out.println("You entered: " + n);
    }
}`,
  python: `print("Hello World!")
n = int(input("Enter a number: "))
print(f"You entered: {n}")`,
  cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello World!" << endl;
    cout << "Enter a number: ";
    int n;
    cin >> n;
    cout << "You entered: " << n << endl;
    return 0;
}`
};

function App() {
  const [language, setLanguage] = useState('java');
  const [code, setCode] = useState(defaultCode.java);
  const [output, setOutput] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [wsConnection, setWsConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  
  const outputEndRef = useRef(null);

  const scrollToBottom = () => {
    outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [output]);

  useEffect(() => {
    setCode(defaultCode[language]);
  }, [language]);

  const appendOutput = (type, text) => {
    setOutput(prev => [...prev, { type, text }]);
  };

  const handleLanguageChange = (e) => {
    setLanguage(e.target.value);
  };

  const handleEditorChange = (value) => {
    setCode(value);
  };

  const connectWebSocket = (sid) => {
    const ws = new WebSocket(`wss://wbc-pdi.duckdns.org/ws/execute/${sid}`);
    
    ws.onopen = () => {
      setIsConnected(true);
      appendOutput('status', 'Connected to WebSocket');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'stdout':
          appendOutput('stdout', message.data);
          break;
        case 'stderr':
          appendOutput('stderr', message.data);
          break;
        case 'status':
          setWaitingForInput(message.waitingForInput);
          if (message.waitingForInput) {
            setTimeout(() => {
              const el = document.getElementById('codeInput');
              if (el) el.focus();
            }, 50);
          }
          break;
        case 'exit':
          appendOutput('status', `Program exited with code ${message.code}`);
          setWaitingForInput(false);
          break;
        case 'error':
          appendOutput('error', message.message);
          break;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setWsConnection(null);
      appendOutput('status', 'WebSocket disconnected');
      setWaitingForInput(false);
    };

    setWsConnection(ws);
  };

  const handleRun = async () => {
    setOutput([]);
    try {
      appendOutput('status', 'Starting execution...');

      const response = await fetch('https://wbc-pdi.duckdns.org/api/v1/execute/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          code,
          language
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.sessionId) {
        throw new Error('No session ID received from server');
      }
      
      setSessionId(data.sessionId);
      appendOutput('status', 'Session created, connecting WebSocket...');
      connectWebSocket(data.sessionId);
    } catch (error) {
      console.error('Execution error:', error);
      appendOutput('error', `Error: ${error.message}. Make sure the backend server is running and accessible.`);
    }
  };

  const handleInput = (e) => {
    if (e.key === 'Enter' && wsConnection && waitingForInput) {
      const input = inputValue;
      wsConnection.send(JSON.stringify({
        type: 'stdin',
        data: input,
        raw: false
      }));
      appendOutput('input', '> ' + inputValue);
      setInputValue('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 shadow-lg px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-2xl font-bold text-blue-500">CodePulz</div>
          <div className="flex items-center space-x-4">
            <select
              value={language}
              onChange={handleLanguageChange}
              className="px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {languages.map(lang => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleRun}
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Run
            </button>
            <button
              onClick={() => setShowAbout(true)}
              className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              About Us
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Editor */}
        <div className="h-[calc(100vh-400px)] min-h-[400px] rounded-lg overflow-hidden mb-6 border border-gray-700">
          <Editor
            height="100%"
            language={language}
            value={code}
            theme="vs-dark"
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              automaticLayout: true,
            }}
          />
        </div>

        {/* Output Console */}
        <div className="border border-gray-700 rounded-lg bg-gray-800 text-white p-4">
          <div className="h-[200px] overflow-y-auto font-mono text-sm">
            {output.map((item, index) => (
              <div
                key={index}
                className={
                  item.type === 'error' ? 'text-red-400' :
                  item.type === 'status' ? 'text-blue-400' :
                  item.type === 'input' ? 'text-green-400' :
                  'text-white'
                }
              >
                {item.text}
              </div>
            ))}
            <div ref={outputEndRef} />
          </div>
          {isConnected && (
            <div className="mt-2">
              <input
                id="codeInput"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleInput}
                placeholder={waitingForInput ? "Enter input..." : "Waiting for program..."}
                disabled={!waitingForInput}
                className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      </main>

      {/* About Us Modal */}
      {showAbout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowAbout(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold text-white mb-4">About CodePulz</h2>
            <p className="text-gray-300 mb-4">
              CodePulz is a modern, web-based code editor that supports multiple programming languages.
              It provides a seamless environment for writing and executing code with real-time output.
            </p>
            <div className="space-y-2">
              <a
                href="https://github.com/Syedowais381"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-blue-400 hover:text-blue-300"
              >
                <span className="mr-2">GitHub</span>
              </a>
              <a
                href="https://www.linkedin.com/in/syed-owais-quadri-60621922a/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-blue-400 hover:text-blue-300"
              >
                <span className="mr-2">LinkedIn</span>
              </a>
              <a
                href="mailto:oquadri381@gmail.com"
                className="flex items-center text-blue-400 hover:text-blue-300"
              >
                <span className="mr-2">Email</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;