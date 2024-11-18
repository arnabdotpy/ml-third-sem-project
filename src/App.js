import React, { useRef, useEffect, useState } from 'react';
// import axios from 'axios';
// import { toast } from 'react-toastify';
import * as faceapi from 'face-api.js';

const VideoCapture = ({ selectedClass }) => {

  const [users, setUsers] = useState([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [name, setName] = useState('');

  const [student, setStudent] = useState(null);

  const [capturedImages, setCapturedImages] = useState([]);
  const [recognizedUser, setRecognizedUser] = useState(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  
  const [loading, setLoading] = useState(false);
  const [attendance, setAttendance] = useState([]);

  const loadModels = async () => {
  try {
    const MODEL_URL = './models';
    console.log("model uri:", MODEL_URL);

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);

    setIsModelLoaded(true);
    console.log("Models loaded successfully");
  } catch (error) {
    console.error("Error loading models:", error);
  }
};

const uploadBase64File = async (base64String, fileName, contentType, folder = '') => {
  
};

  const saveUsersToStorage = (updatedUsers) => {
    try {
      const serializableUsers = updatedUsers.map(user => ({
        ...user,
        descriptors: user.descriptors.map(desc => Array.from(desc))
      }));
      localStorage.setItem('faceUsers', JSON.stringify(serializableUsers));
      setUsers(updatedUsers);  // Keep the original format in state
    } catch (error) {
      console.error('Error saving users to storage:', error);
    }
  };

  const registerUser = async () => {

    setLoading(true); 
  
    const capImages = await captureImages();

    console.log("capturedImages", capImages);

    if (capImages.length < 1) {
      alert("Please capture 2 images before registering");
      return;
    }

    const newUser = {
      name: name,
      descriptors: capImages,
      attendance: 'Absent'
    };

    console.log("new user:", newUser);

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    saveUsersToStorage(updatedUsers);
    
    setName('');
    setCapturedImages([]);
    console.log("User registered:", newUser);
    setLoading(false);
  }

  const startVideo = () => {

    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !videoRef) {
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: true })
      .then((currentStream) => {
        videoRef.current.srcObject = currentStream;
      })
      .catch((err) => {
        console.error('Error:', err);
      });
  }

  const faceMyDetect = () => {
    if (!isModelLoaded) return;

    const interval = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;

      const detections = await faceapi.detectAllFaces(
        videoRef.current, 
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptors().withFaceExpressions();

      const context = canvasRef.current.getContext('2d');
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      const displaySize = { width: videoRef.current.width, height: videoRef.current.height };
      faceapi.matchDimensions(canvasRef.current, displaySize);

      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
      faceapi.draw.drawFaceExpressions(canvasRef.current, resizedDetections);

      if (detections.length === 0) {
        setStudent('Unknown');
      } else if (users.length > 0) {
        const labeledDescriptors = users.map(user => 
          new faceapi.LabeledFaceDescriptors(user.name, user.descriptors)
        );
        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors);

        let recognizedFace = false;

        resizedDetections.forEach(detection => {
          const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
          const box = detection.detection.box;
          const drawBox = new faceapi.draw.DrawBox(box, { label: bestMatch.toString() });
          drawBox.draw(canvasRef.current);
          if (bestMatch.label !== 'unknown') {
            
            setStudent(bestMatch.label);
            
            // Check if the user is smiling
            if (detection.expressions.happy > 0.8) {  // Adjust this threshold as needed
              const updatedUsers = users.map(user => {
                if (user.name === bestMatch.label && user.attendance !== 'Present') {
                  return { ...user, attendance: 'Present' };
                }
                return user;
              });
              setUsers(updatedUsers);
              saveUsersToStorage(updatedUsers);
              console.log(`${bestMatch.label} marked present!`);
            }
          } else {
            setStudent('Unknown');
          }
        });

        if (recognizedFace) {
          setStudent('Unknown');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }

  const captureImages = async () => {

    let imagesCaptured = [];

    if (!isModelLoaded) {
      console.log("Models not loaded yet");
      return;
    }

    let count = 3
  
    const captureWithDelay = async (index) => {
      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
      if (detection) {
        setCapturedImages(prev => [...prev, detection.descriptor]);
        imagesCaptured = [...imagesCaptured, detection.descriptor];
        console.log(`Face captured (${index + 1}/${count})`);
      } else {
        console.log(`No face detected (${index + 1}/${count})`);
      }
      return detection;
    };
  
    for (let i = 0; i < count; i++) {
      await captureWithDelay(i);
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log("Finished capturing images", imagesCaptured);
    return imagesCaptured;
  };

  const getAttendanceData = async () => {
    // TODO
    // setAttendance
  };

  const loadUsersFromStorage = () => {
    try {
      const storedUsers = localStorage.getItem('faceUsers');
      if (storedUsers) {
        const parsedUsers = JSON.parse(storedUsers);
        const reconstitutedUsers = parsedUsers.map(user => ({
          ...user,
          descriptors: user.descriptors.map(desc => new Float32Array(desc))
        }));
        setUsers(reconstitutedUsers);
      }
    } catch (error) {
      console.error('Error loading users from storage:', error);
    }
  };

  useEffect(() => {
    if (isModelLoaded) {
      const cleanup = faceMyDetect();
      return cleanup;
    }
  }, [isModelLoaded, users]);

  useEffect(() => {
    // localStorage.getItem('loggedIn') || window.location.replace('/');
    loadUsersFromStorage();
    startVideo();
    loadModels();
  }, []);

  useEffect(() => {
    getAttendanceData();
  }, [student, selectedClass]);

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.leftPanel}>
          <div style={styles.statusBox}>
            <p style={styles.statusText}>
              Present : <span style={styles.presentStatus}>{users.filter((item) => item.attendance === 'Present').length}</span>
              Absent : <span style={styles.absentStatus}>{users.filter((item) => item.attendance === 'Absent').length}</span>
            </p>
          </div>
          <p style={styles.title}>Facial Recognition Attendance</p>
          <div style={styles.videoContainer}>
            <video style={styles.video} ref={videoRef} autoPlay width="400" height="400"></video>
            <canvas ref={canvasRef} width="400" height="400" style={styles.canvas} />
            <h3 style={styles.nameBox}>
              {student ? student : "Unknown"}
            </h3>
          </div>
          <form style={styles.form} onSubmit={(e) => {e.preventDefault(); registerUser(); }}>
            <input 
              type='text' 
              placeholder='Enter Student Name' 
              value={name} 
              onChange={(e) => { setName(e.target.value) }} 
              style={styles.input}
            />
            <button type='submit' style={styles.button}>{loading ? 'Adding...' : 'Add'}</button>
          </form>
          <p style={styles.instruction}>Please stand in front of Webcam in a way such that your face must be clearly visible</p>
        </div>
        <div style={styles.rightPanel}>
          {users.map((item, index) => (
            <div key={index} style={styles.userCard}>
              <div style={styles.userInfo}>
                <p style={styles.userName}>{item.name.split('/').pop()}</p>
                <span style={styles.userAttendance(item.attendance)}>{item.attendance}</span>
              </div>
            </div>
          ))}
          {users.length === 0 && <p style={styles.noData}>No Attendance Data</p>}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#1B2124',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    fontFamily: 'Arial, sans-serif',
  },
  content: {
    display: 'flex',
    padding: '0 40px',
    gap: '32px',
    paddingBottom: '24px',
    height: 'calc(100vh - 6rem)',
    flexDirection: 'row',
  },
  leftPanel: {
    maxWidth: '540px',
    padding: '40px 96px',
    borderRadius: '12px',
    backgroundColor: 'black',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBox: {
    backgroundColor: '#1B2124',
    padding: '12px 32px',
    borderRadius: '24px',
  },
  statusText: {
    display: 'inline',
  },
  presentStatus: {
    color: '#1B7938',
    backgroundColor: '#ADCFB7',
    padding: '4px 12px',
    fontWeight: 600,
    borderRadius: '16px',
    marginRight: '8px',
  },
  absentStatus: {
    color: '#D64545',
    backgroundColor: '#F0B3B2',
    padding: '4px 12px',
    fontWeight: 600,
    borderRadius: '16px',
  },
  title: {
    textAlign: 'center',
    fontWeight: 600,
    fontSize: '18px',
    margin: '20px 0',
  },
  videoContainer: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#4ade80',
    overflow: 'hidden',
    margin: '0 auto',
    borderRadius: '16px',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '12px',
    transform: 'scaleX(-1)',
  },
  canvas: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '12px',
    zIndex: 10,
  },
  nameBox: {
    position: 'absolute',
    fontSize: '18px',
    boxShadow: '0 4px 6px rgba(90, 75, 218, 0.5)',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    padding: '4px 8px',
    minWidth: '160px',
    color: 'black',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    marginTop: '20px',
    width: '100%',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #4a5568',
    alignItems: 'center',
  },
  input: {
    fontSize: '16px',
    flex: 1,
    padding: '10px 8px',
    backgroundColor: 'transparent',
    outline: 'none',
    color: 'white',
    height: '100%',
    border: 'none'
  },
  button: {
    fontSize: '16px',
    color: '#3182ce',
    padding: '0 8px',
    backgroundColor: 'transparent',
    border: 'none'
  },
  instruction: {
    textAlign: 'center',
    fontSize: '14px',
    margin: '8px 0',
    color: '#cbd5e0',
  },
  rightPanel: {
    display: 'flex',
    width: '100%',
    paddingTop: '24px',
    flexWrap: 'wrap',
    gap: '16px',
    overflowY: 'auto',
    maxHeight: '100%',
    height: 'fit-content',
  },
  userCard: {
    backgroundColor: 'black',
    width: '100px',
    height: '100px',
    borderRadius: '8px',
    position: 'relative',
  },
  userInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    color: 'white',
    padding: '4px',
    paddingBottom: '4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    fontSize: '12px',
    backgroundColor: 'rgba(27, 33, 36, 0.9)',
    width: '96px',
    overflow: 'hidden',
    padding: '2px 8px',
    borderRadius: '8px',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  userAttendance: (attendance) => ({
    fontSize: '12px',
    backgroundColor: attendance === 'Present' ? '#1B7938' : '#D64545',
    width: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '2px 0',
    borderRadius: '9999px',
  }),
  noData: {
    color: 'white',
    margin: 'auto',
    textAlign: 'center',
    width: '100%',
  },
};

export default VideoCapture;