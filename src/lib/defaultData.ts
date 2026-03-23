import { ScheduleTemplate } from '@/types';

export const DEFAULT_TEMPLATE: ScheduleTemplate = {
  id: 'default-template',
  name: 'Default Daily Template',
  blocks: [
    { title: 'Getting Ready', startTime: '04:00', endTime: '06:00', type: 'flexible', status: 'pending', id: 'gen-ready' },
    { title: 'Gym',           startTime: '06:00', endTime: '08:00', type: 'fixed',    status: 'pending', id: 'gen-gym' },
    { title: 'Office',        startTime: '08:00', endTime: '12:00', type: 'fixed',    status: 'pending', id: 'gen-office1' },
    { title: 'Lunch',         startTime: '12:00', endTime: '12:30', type: 'flexible', status: 'pending', id: 'gen-lunch' },
    { title: 'Office',        startTime: '12:30', endTime: '17:00', type: 'fixed',    status: 'pending', id: 'gen-office2' },
    { title: 'Personal time', startTime: '17:00', endTime: '19:00', type: 'flexible', status: 'pending', id: 'gen-personal' },
    { title: 'Dinner',        startTime: '19:00', endTime: '19:30', type: 'fixed',    status: 'pending', id: 'gen-dinner' },
    { title: 'Prep for next day', startTime: '19:30', endTime: '20:00', type: 'flexible', status: 'pending', id: 'gen-prep' },
    { title: 'Office work',   startTime: '20:00', endTime: '21:00', type: 'flexible', status: 'pending', id: 'gen-work' },
    { title: 'Habits + Journal', startTime: '21:00', endTime: '21:30', type: 'fixed', status: 'pending', id: 'gen-habits' },
    { title: 'Sleep',         startTime: '21:30', endTime: '04:00', type: 'fixed',    status: 'pending', id: 'gen-sleep' },
  ]
};
