import React, { useRef, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback
} from 'react-native';
import { 
  actions, 
  RichEditor, 
  RichToolbar 
} from 'react-native-pell-rich-editor';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  ChevronDown, 
  Check,
  BarChart2
} from 'lucide-react-native';

function ToolbarDropdown({ icon: Icon, label, options, onSelect, currentValue }) {
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef();
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const toggle = () => {
    if (visible) {
      setVisible(false);
    } else {
    triggerRef.current.measure((x, y, width, height, pageX, pageY) => {
          setPos({ top: pageY + height, left: pageX - 10 });
          setVisible(true);
        });

    }
  };

  return (
    <View>
      <TouchableOpacity 
        ref={triggerRef}
        style={styles.dropdownTrigger} 
        onPress={toggle}
      >
          <Icon size={18} color="rgba(255,255,255,0.6)" />
          {label && <Text style={styles.dropdownText}>{label}</Text>}
          <ChevronDown size={10} color="rgba(255,255,255,0.3)" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent={true}
        animationType="none"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[
              styles.dropdownMenu, 
              { 
                position: 'absolute',
                top: pos.top,
                left: Math.max(10, Math.min(pos.left, 150)),
              }
            ]}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.dropdownItem}
                  onPress={() => {
                    onSelect(option.value);
                    setVisible(false);
                  }}
                >
                  <option.icon size={18} color={currentValue === option.value ? '#007AFF' : '#FFFFFF'} />
                  <Text style={[
                    styles.dropdownItemText,
                    currentValue === option.value && { color: '#007AFF', fontWeight: 'bold' }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

export function RichTextEditor({ value, onChange, placeholder, onPollPress, minHeight = 400 }) {
  const richText = useRef();

  const handleListSelect = (type) => {
    if (type === 'bullets') {
      richText.current?.executeAction(actions.insertBulletsList);
    } else if (type === 'numbers') {
      richText.current?.executeAction(actions.insertOrderedList);
    }
  };

  const listOptions = [
    { label: 'Bullets', value: 'bullets', icon: List },
    { label: 'Numbers', value: 'numbers', icon: ListOrdered },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.toolbarContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarContent}
        >
          <ToolbarDropdown 
            icon={List} 
            options={listOptions}
            onSelect={handleListSelect}
          />

          <View style={styles.separator} />

          <RichToolbar
            editor={richText}
            actions={[
              actions.setBold,
              actions.setItalic,
              actions.setUnderline,
            ]}
            iconMap={{
              [actions.setBold]: ({ tintColor }) => <Bold size={18} color={tintColor} />,
              [actions.setItalic]: ({ tintColor }) => <Italic size={18} color={tintColor} />,
              [actions.setUnderline]: ({ tintColor }) => <Underline size={18} color={tintColor} />,
            }}
            style={styles.subToolbar}
            flatContainerStyle={styles.flatStyle}
            selectedIconTint="#007AFF"
            iconTint="rgba(255,255,255,0.6)"
          />

          {onPollPress && (
            <>
              <View style={styles.separator} />
              <TouchableOpacity 
                style={styles.dropdownTrigger}
                onPress={onPollPress}
              >
                <BarChart2 size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>

      <View style={[styles.editorWrapper, { minHeight }]}>
        <RichEditor
          ref={richText}
          initialContentHTML={value}
          onChange={onChange}
          placeholder={placeholder}
          editorStyle={{
            backgroundColor: '#000000',
            color: '#FFFFFF',
            placeholderColor: 'rgba(255,255,255,0.2)',
            contentCSSText: `
              font-size: 18px; 
              line-height: 28px; 
              font-family: -apple-system, sans-serif;
              padding: 15px;
              color: #FFFFFF;
            `,
          }}
          style={styles.richEditor}
          useContainer={true}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
  },
  toolbarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#111111',
    paddingVertical: 10,
  },
  toolbarContent: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  subToolbar: {
    backgroundColor: 'transparent',
  },
  flatStyle: {
    paddingHorizontal: 0,
    gap: 12,
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 12,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  dropdownText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdownMenu: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 4,
    width: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
    borderRadius: 8,
  },
  dropdownItemText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  editorWrapper: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    marginVertical: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  richEditor: {
    flex: 1,
  },
});

