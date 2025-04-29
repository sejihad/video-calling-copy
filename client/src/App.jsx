import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("https://video-calling-copy-api.onrender.com");

const App = () => {
  const [roomName, setRoomName] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [callStatus, setCallStatus] = useState("Disconnected");

  const localAudioRef = useRef();
  const remoteAudioRef = useRef();
  const peer = useRef(null);
  const localStream = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        localAudioRef.current.srcObject = stream;
        localStream.current = stream;
      } catch (err) {
        console.error("Failed to get local media", err);
      }
    };

    init();

    return () => {
      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => track.stop());
      }
      if (peer.current) {
        peer.current.close();
      }
      socket.off();
    };
  }, []);

  const createPeer = () => {
    peer.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        peer.current.addTrack(track, localStream.current);
      });
    }

    peer.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          roomName,
          candidate: event.candidate,
        });
      }
    };

    peer.current.ontrack = (event) => {
      if (!remoteAudioRef.current.srcObject) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    peer.current.onconnectionstatechange = () => {
      setCallStatus(peer.current.connectionState);
    };
  };

  useEffect(() => {
    socket.on("user-joined", async (otherUserId) => {
      console.log("Another user joined:", otherUserId);
      createPeer();
      setCallStatus("Calling...");

      try {
        const offer = await peer.current.createOffer();
        await peer.current.setLocalDescription(offer);
        socket.emit("call", { roomName, offer });
      } catch (err) {
        console.error("Error creating offer", err);
      }
    });

    socket.on("incoming-call", async ({ from, offer }) => {
      console.log("Incoming call from:", from);
      createPeer();

      try {
        await peer.current.setRemoteDescription(
          new RTCSessionDescription(offer)
        );
        const answer = await peer.current.createAnswer();
        await peer.current.setLocalDescription(answer);
        socket.emit("answer", { roomName, answer });
        setCallStatus("Connected");
      } catch (err) {
        console.error("Error answering call", err);
      }
    });

    socket.on("call-answered", async ({ from, answer }) => {
      console.log("Call answered by:", from);
      try {
        await peer.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        setCallStatus("Connected");
      } catch (err) {
        console.error("Error handling answer", err);
      }
    });

    socket.on("ice-candidate", ({ from, candidate }) => {
      if (candidate && peer.current) {
        peer.current
          .addIceCandidate(new RTCIceCandidate(candidate))
          .catch((err) => console.error("Error adding ICE candidate", err));
      }
    });

    return () => {
      socket.off("user-joined");
      socket.off("incoming-call");
      socket.off("call-answered");
      socket.off("ice-candidate");
    };
  }, [roomName]);

  const handleJoinRoom = () => {
    if (!roomName.trim()) return;
    socket.emit("join-room", roomName);
    setIsJoined(true);
    setCallStatus("Waiting for others...");
  };

  return (
    <div
      style={{
        textAlign: "center",
        marginTop: "40px",
        fontFamily: "sans-serif",
      }}
    >
      <h2>🎧 Real-Time Voice Call with Room (React + Node)</h2>
      <p>
        Status: <strong>{callStatus}</strong>
      </p>
      {!isJoined ? (
        <>
          <input
            type="text"
            placeholder="Enter Room Name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            style={{ padding: "8px", marginRight: "10px", width: "260px" }}
          />
          <button
            onClick={handleJoinRoom}
            style={{ padding: "8px 20px", cursor: "pointer" }}
          >
            🚪 Join Room
          </button>
        </>
      ) : (
        <p>
          ✅ Joined Room: <strong>{roomName}</strong>
        </p>
      )}

      <div style={{ marginTop: "30px" }}>
        <h4>🔊 Audio Streams:</h4>
        <div>
          Local: <audio ref={localAudioRef} autoPlay muted />
        </div>
        <div>
          Remote: <audio ref={remoteAudioRef} autoPlay />
        </div>
      </div>
    </div>
  );
};

export default App;
