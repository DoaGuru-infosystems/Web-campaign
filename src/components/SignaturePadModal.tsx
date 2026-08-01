import React from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { styles } from '../styles/theme';

export interface SignaturePadModalProps {
  visible: boolean;
  onClose: () => void;
  signaturePaths: string[][];
  currentSignaturePath: string[];
  ocrLoading: boolean;
  ocrMessage: string;
  handleSignatureTouchStart: (e: any) => void;
  handleSignatureTouchMove: (e: any) => void;
  handleSignatureTouchEnd: () => void;
  handleClearSignature: () => void;
  handleSaveSignature: () => void;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  visible,
  onClose,
  signaturePaths,
  currentSignaturePath,
  ocrLoading,
  ocrMessage,
  handleSignatureTouchStart,
  handleSignatureTouchMove,
  handleSignatureTouchEnd,
  handleClearSignature,
  handleSaveSignature,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Signature Pad</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.signaturePadBody}>
          <Text style={styles.modalSubtitle}>Draw your signature inside the white panel using your finger.</Text>
          
          {/* Signature Draw view container */}
          <View 
            style={styles.signatureDrawingArea}
            onTouchStart={handleSignatureTouchStart}
            onTouchMove={handleSignatureTouchMove}
            onTouchEnd={handleSignatureTouchEnd}
          >
            <Svg style={styles.signatureSvg}>
              {signaturePaths.map((p, idx) => (
                <Path key={idx} d={p.join(' ')} fill="none" stroke="#000000" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {currentSignaturePath.length > 0 && (
                <Path d={currentSignaturePath.join(' ')} fill="none" stroke="#000000" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
              )}
            </Svg>
          </View>

          {ocrMessage !== '' && (
            <View style={styles.ocrLoadingBox}>
              <ActivityIndicator color="#4f46e5" style={{ marginBottom: 6 }} />
              <Text style={styles.ocrMessageText}>{ocrMessage}</Text>
            </View>
          )}

          <View style={styles.signatureActionRow}>
            <TouchableOpacity style={styles.clearSigBtn} onPress={handleClearSignature}>
              <Text style={styles.clearSigText}>Clear Canvas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveSigBtn} onPress={handleSaveSignature} disabled={ocrLoading}>
              <Text style={styles.saveSigText}>Capture & Upload Signature</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
