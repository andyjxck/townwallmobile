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
  BarChart2
} from 'lucide-react-native';

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder, 
  onPollPress, 
  minHeight = 400,
  backgroundColor = '#000000'
}) {
  const richText = useRef();

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.toolbarContainer}>
        <View 
          style={styles.toolbarContent}
        >
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
            selectedIconTint="#FFF"
            iconTint="rgba(255,255,255,0.4)"
          />

          {onPollPress && (
            <>
              <View style={styles.separator} />
              <TouchableOpacity 
                style={styles.pollBtn}
                onPress={onPollPress}
              >
                <BarChart2 size={18} color="rgba(255,255,255,0.6)" />
                <Text style={styles.pollBtnText}>Add Poll</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={[styles.editorWrapper, { minHeight, backgroundColor }]}>
        <RichEditor
          ref={richText}
          initialContentHTML={value}
          onChange={onChange}
          placeholder={placeholder}
          editorStyle={{
            backgroundColor: backgroundColor,
            color: '#FFFFFF',
            placeholderColor: 'rgba(255,255,255,0.2)',
            contentCSSText: `
              font-size: 18px; 
              line-height: 28px; 
              font-family: -apple-system, sans-serif;
              padding: 0px;
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
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  toolbarContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  subToolbar: {
    backgroundColor: 'transparent',
  },
  flatStyle: {
    paddingHorizontal: 0,
    gap: 8,
  },
  separator: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 8,
  },
  pollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  pollBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
  },
  editorWrapper: {
    marginVertical: 10,
    backgroundColor: '#000000',
  },
  richEditor: {
    flex: 1,
  },
});

