import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, Image, ActivityIndicator, SafeAreaView } from 'react-native';
import { SvgIcon } from './SvgIcon';
import { styles } from '../styles/theme';

export interface AadharScannerModalProps {
  visible: boolean;
  onClose: () => void;
  frontImageUri: string | null;
  setFrontImageUri: (val: string | null) => void;
  backImageUri: string | null;
  setBackImageUri: (val: string | null) => void;
  ocrLoading: boolean;
  ocrMessage: string;
  handleCaptureOcrSide: (side: 'front' | 'back', useCamera: boolean) => void;
  handleTriggerOcrExtraction: () => void;
}

export const AadharScannerModal: React.FC<AadharScannerModalProps> = ({
  visible,
  onClose,
  frontImageUri,
  setFrontImageUri,
  backImageUri,
  setBackImageUri,
  ocrLoading,
  ocrMessage,
  handleCaptureOcrSide,
  handleTriggerOcrExtraction,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Aadhaar Card Scanner</Text>
          <TouchableOpacity 
            onPress={() => {
              if (!ocrLoading) onClose();
            }}
          >
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalScroll}>
          <Text style={styles.modalSubtitle}>
            Select or take a picture of the front and back of the Aadhaar card to extract data.
          </Text>

          {/* Front Image preview card */}
          <View style={styles.scanPreviewBox}>
            <Text style={styles.scanLabel}>Aadhaar Front Side (Identity details)</Text>
            {frontImageUri ? (
              <View style={styles.imagePreviewWrapper}>
                <Image source={{ uri: frontImageUri }} style={styles.scannedThumbnail} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => setFrontImageUri(null)}>
                  <Text style={styles.removeImageText}>Retake Front</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.scanButtonRow}>
                <TouchableOpacity style={styles.scanPickerBtn} onPress={() => handleCaptureOcrSide('front', true)}>
                  <SvgIcon type="camera" color="#4f46e5" size={16} />
                  <Text style={styles.scanPickerText}>Capture Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.scanPickerBtn} onPress={() => handleCaptureOcrSide('front', false)}>
                  <SvgIcon type="upload" color="#4f46e5" size={16} />
                  <Text style={styles.scanPickerText}>Gallery Pick</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Back Image preview card */}
          <View style={styles.scanPreviewBox}>
            <Text style={styles.scanLabel}>Aadhaar Back Side (Address details)</Text>
            {backImageUri ? (
              <View style={styles.imagePreviewWrapper}>
                <Image source={{ uri: backImageUri }} style={styles.scannedThumbnail} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => setBackImageUri(null)}>
                  <Text style={styles.removeImageText}>Retake Back</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.scanButtonRow}>
                <TouchableOpacity style={styles.scanPickerBtn} onPress={() => handleCaptureOcrSide('back', true)}>
                  <SvgIcon type="camera" color="#4f46e5" size={16} />
                  <Text style={styles.scanPickerText}>Capture Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.scanPickerBtn} onPress={() => handleCaptureOcrSide('back', false)}>
                  <SvgIcon type="upload" color="#4f46e5" size={16} />
                  <Text style={styles.scanPickerText}>Gallery Pick</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Status alert message */}
          {ocrMessage !== '' && (
            <View style={styles.ocrLoadingBox}>
              {ocrLoading && <ActivityIndicator color="#4f46e5" style={{ marginBottom: 8 }} />}
              <Text style={styles.ocrMessageText}>{ocrMessage}</Text>
            </View>
          )}

          <TouchableOpacity 
            style={[
              styles.runOcrTriggerBtn, 
              (!frontImageUri && !backImageUri) || ocrLoading ? styles.runOcrTriggerBtnDisabled : null
            ]} 
            onPress={handleTriggerOcrExtraction}
            disabled={(!frontImageUri && !backImageUri) || ocrLoading}
          >
            <Text style={styles.runOcrTriggerText}>
              {ocrLoading ? 'Extracting via Cloud OCR...' : 'Run OCR & Autofill'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};
