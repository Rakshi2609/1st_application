import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  type Frequency = 'once' | 'daily' | 'weekly';
  type Todo = {
    id: string;
    text: string;
    done: boolean;
    frequency: Frequency;
    reminderTime?: string; // ISO time HH:mm
    weekday?: number; // 0-6 (Sun-Sat) for weekly
    deadline?: string; // ISO date YYYY-MM-DD
    notificationId?: string; // scheduled notification id
    deadlineNotificationId?: string; // one-time deadline reminder id
  };
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('once');
  const [reminderTime, setReminderTime] = useState<string | undefined>(undefined);
  const [weekday, setWeekday] = useState<number>(new Date().getDay());
  const [deadline, setDeadline] = useState<string | undefined>(undefined);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Configure notification handling and Android channel
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Reminders',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
    })();
  }, []);

  const canAdd = useMemo(() => text.trim().length > 0, [text]);

  const addTodo = useCallback(async () => {
    const t = text.trim();
    if (!t) return;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
  let notificationId: string | undefined;
  let deadlineNotificationId: string | undefined;
    // Schedule reminder if frequency and reminderTime present
    if (reminderTime && (frequency === 'daily' || frequency === 'weekly' || frequency === 'once')) {
      const [hh, mm] = reminderTime.split(':').map((n) => parseInt(n, 10));
      const triggerDate = new Date();
      triggerDate.setHours(hh, mm, 0, 0);
      if (frequency === 'weekly') {
        // move to upcoming selected weekday
        const diff = (weekday - triggerDate.getDay() + 7) % 7;
        triggerDate.setDate(triggerDate.getDate() + (diff === 0 && triggerDate < new Date() ? 7 : diff));
      }
      if (frequency === 'once') {
        // If time already passed today, schedule next day
        const now = new Date();
        if (triggerDate <= now) triggerDate.setDate(triggerDate.getDate() + 1);
      }
      const trigger: Notifications.NotificationTriggerInput =
        frequency === 'daily'
          ? { channelId: 'reminders', repeats: true, hour: hh, minute: mm }
          : frequency === 'weekly'
          ? { channelId: 'reminders', repeats: true, weekday: (weekday + 1) as any, hour: hh, minute: mm }
          : { channelId: 'reminders', date: triggerDate };
      notificationId = await Notifications.scheduleNotificationAsync({
        content: { title: 'Task reminder', body: t },
        trigger,
      });
    }

    // Schedule one-off deadline notification if a deadline is set in the future
    if (deadline) {
      const [yy, mm, dd] = deadline.split('-').map((n) => parseInt(n, 10));
      const when = new Date(yy, mm - 1, dd);
      const [dh, dm] = (reminderTime ?? '09:00').split(':').map((n) => parseInt(n, 10));
      when.setHours(dh, dm, 0, 0);
      if (when > new Date()) {
        deadlineNotificationId = await Notifications.scheduleNotificationAsync({
          content: { title: 'Deadline today', body: t },
          trigger: { channelId: 'reminders', date: when },
        });
      }
    }

    const newTodo: Todo = {
      id,
      text: t,
      done: false,
      frequency,
      reminderTime,
      weekday: frequency === 'weekly' ? weekday : undefined,
      deadline,
      notificationId,
      deadlineNotificationId,
    };
    setTodos((prev) => [newTodo, ...prev]);
    setText('');
  }, [text, frequency, reminderTime, weekday, deadline]);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) => prev.map((td) => (td.id === id ? { ...td, done: !td.done } : td)));
  }, []);

  const deleteTodo = useCallback(async (id: string) => {
    setTodos((prev) => {
      const td = prev.find((x) => x.id === id);
      if (td?.notificationId) {
        Notifications.cancelScheduledNotificationAsync(td.notificationId).catch(() => {});
      }
      if (td?.deadlineNotificationId) {
        Notifications.cancelScheduledNotificationAsync(td.deadlineNotificationId).catch(() => {});
      }
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Welcome!</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.todoContainer}>
        <ThemedText type="subtitle">Todo List</ThemedText>
        <View style={styles.inputRow}>
          <TextInput
            placeholder="Add a task..."
            value={text}
            onChangeText={setText}
            onSubmitEditing={addTodo}
            returnKeyType="done"
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            onPress={addTodo}
            disabled={!canAdd}
            style={({ pressed }) => [styles.addButton, (!canAdd || pressed) && styles.addButtonDisabled]}
          >
            <ThemedText type="defaultSemiBold" style={styles.addButtonText}>Add</ThemedText>
          </Pressable>
        </View>

        <View style={styles.rowWrap}>
          <View style={styles.segment}>
            <Pressable onPress={() => setFrequency('once')} style={[styles.segmentBtn, frequency === 'once' && styles.segmentBtnActive]}>
              <ThemedText style={styles.segmentText}>Once</ThemedText>
            </Pressable>
            <Pressable onPress={() => setFrequency('daily')} style={[styles.segmentBtn, frequency === 'daily' && styles.segmentBtnActive]}>
              <ThemedText style={styles.segmentText}>Daily</ThemedText>
            </Pressable>
            <Pressable onPress={() => setFrequency('weekly')} style={[styles.segmentBtn, frequency === 'weekly' && styles.segmentBtnActive]}>
              <ThemedText style={styles.segmentText}>Weekly</ThemedText>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={() => setShowTimePicker(true)} style={styles.pickBtn}>
              <ThemedText type="defaultSemiBold">{reminderTime ? `⏰ ${reminderTime}` : 'Set time'}</ThemedText>
            </Pressable>
            <Pressable onPress={() => setShowDatePicker(true)} style={styles.pickBtn}>
              <ThemedText type="defaultSemiBold">{deadline ? `📅 ${deadline}` : 'Deadline'}</ThemedText>
            </Pressable>
          </View>
        </View>

        {frequency === 'weekly' && (
          <View style={styles.weekRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
              <Pressable key={idx} onPress={() => setWeekday(idx)} style={[styles.weekBtn, weekday === idx && styles.weekBtnActive]}>
                <ThemedText style={styles.segmentText}>{d}</ThemedText>
              </Pressable>
            ))}
          </View>
        )}

        {showTimePicker && (
          <DateTimePicker
            value={new Date()}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(e, date) => {
              setShowTimePicker(false);
              if (date) {
                const hh = String(date.getHours()).padStart(2, '0');
                const mm = String(date.getMinutes()).padStart(2, '0');
                setReminderTime(`${hh}:${mm}`);
              }
            }}
          />
        )}

        {showDatePicker && (
          <DateTimePicker
            value={new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(e, date) => {
              setShowDatePicker(false);
              if (date) {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                setDeadline(`${yyyy}-${mm}-${dd}`);
              }
            }}
          />
        )}

        <View style={{ gap: 8 }}>
          {todos.length === 0 ? (
            <ThemedText lightColor="#666" darkColor="#aaa">No tasks yet. Add one above.</ThemedText>
          ) : (
            todos.map((td) => (
              <ThemedView key={td.id} style={styles.todoItem}>
                <Pressable onPress={() => toggleTodo(td.id)} style={styles.todoMain}>
                  <ThemedText style={styles.check}>{td.done ? '✅' : '⬜️'}</ThemedText>
                  <ThemedText style={[styles.todoText, td.done && styles.todoTextDone]}>
                    {td.text}
                  </ThemedText>
                </Pressable>
                <View style={{ alignItems: 'flex-end' }}>
                  <ThemedText lightColor="#666" darkColor="#aaa" style={{ fontSize: 12 }}>
                    {td.frequency !== 'once' ? `${td.frequency}${td.reminderTime ? ' @ ' + td.reminderTime : ''}` : td.reminderTime ? `@ ${td.reminderTime}` : ''}
                    {td.frequency === 'weekly' && typeof td.weekday === 'number' ? ` (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][td.weekday]})` : ''}
                  </ThemedText>
                  {td.deadline && (
                    <ThemedText lightColor="#666" darkColor="#aaa" style={{ fontSize: 12 }}>
                      Due: {td.deadline}
                    </ThemedText>
                  )}
                  <Pressable accessibilityRole="button" onPress={() => deleteTodo(td.id)}>
                    <ThemedText type="link">Delete</ThemedText>
                  </Pressable>
                </View>
              </ThemedView>
            ))
          )}
        </View>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todoContainer: {
    gap: 12,
    marginBottom: 16,
    paddingTop: 4,
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(127,127,127,0.08)',
    padding: 4,
    borderRadius: 10,
  },
  segmentBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(10,126,164,0.12)',
  },
  segmentText: {
    fontSize: 14,
  },
  pickBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  weekBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
  },
  weekBtnActive: {
    backgroundColor: 'rgba(10,126,164,0.12)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 12, android: 8, default: 8 }),
    borderRadius: 8,
    backgroundColor: 'rgba(127,127,127,0.05)',
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0a7ea4',
  },
  addButtonDisabled: {
    backgroundColor: '#7fb7c7',
  },
  addButtonText: {
    color: 'white',
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  todoMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  check: {
    width: 24,
  },
  todoText: {
    flex: 1,
    fontSize: 16,
  },
  todoTextDone: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
