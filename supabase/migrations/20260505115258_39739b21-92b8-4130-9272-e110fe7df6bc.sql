INSERT INTO public.agent_departments (agent_id, department_id) VALUES
('e38d25f4-880c-4ea2-89c2-e71053d584aa','4d7a7aa5-5bd9-4714-96d0-8798c5d17877'),
('e38d25f4-880c-4ea2-89c2-e71053d584aa','a1b2c3d4-e5f6-7890-abcd-ef1234567890')
ON CONFLICT DO NOTHING;