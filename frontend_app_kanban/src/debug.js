import { defaultDebug } from 'tracim_frontend_lib'

export const debug = {
  ...defaultDebug,
  config: {
    ...defaultDebug.config,
    slug: 'kanban',
    faIcon: 'far fa-comments',
    hexcolor: '#428BCA',
    creationLabel: 'Start a topic',
    label: 'Kanban',
    workspace: {
      downloadEnabled: true
    }
  },
  content: {
    ...defaultDebug.content,
    content_id: 5,
    content_type: 'kanban',
    workspace_id: 1
  }
}
