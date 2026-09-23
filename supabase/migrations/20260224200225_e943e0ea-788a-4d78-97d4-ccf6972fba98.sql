
ALTER TABLE public.chatbot_configs 
ADD COLUMN menu_options jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.chatbot_configs.menu_options IS 'Array of menu option objects: [{text, action, target_menu_id}]';
