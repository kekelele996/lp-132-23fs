import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Select, message, Tabs } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/auth';
import { PROFESSIONAL_SKILLS, GENERAL_SKILLS } from '../constants/skills';

const { Title, Text } = Typography;
const { Option } = Select;

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [registerForm] = Form.useForm();
  const registerRole = Form.useWatch('role', registerForm);
  const { setToken, setUser } = useAuthStore();

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      const response = await authApi.login(values);
      setToken(response.data.token);
      setUser(response.data.user);
      message.success('登录成功');
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: any) => {
    setLoading(true);
    try {
      const response = await authApi.register(values);
      setToken(response.data.token);
      setUser(response.data.user);
      message.success('注册成功');
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const loginItems = [
    {
      label: '登录',
      key: 'login',
      children: (
        <Form
          name="login"
          onFinish={handleLogin}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      label: '注册',
      key: 'register',
      children: (
        <Form
          form={registerForm}
          name="register"
          onFinish={handleRegister}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item
            name="real_name"
            rules={[{ required: true, message: '请输入真实姓名' }]}
          >
            <Input placeholder="真实姓名" />
          </Form.Item>

          <Form.Item
            name="phone"
            rules={[{ required: true, message: '请输入手机号' }]}
          >
            <Input placeholder="手机号" />
          </Form.Item>

          <Form.Item
            name="role"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="选择角色">
              <Option value="child">子女家属</Option>
              <Option value="worker">专业护工</Option>
              <Option value="volunteer">志愿者</Option>
            </Select>
          </Form.Item>

          {(registerRole === 'worker' || registerRole === 'volunteer') && (
            <Form.Item
              name="skills"
              label="护理技能"
              extra={
                registerRole === 'volunteer'
                  ? '志愿者可参与陪诊、聊天、代购和日常陪伴，不能承接健康检查、医疗协助等专业护理。'
                  : '请选择您已掌握的护理技能，接单时系统会按家属要求逐项核对。'
              }
            >
              <Select
                mode="multiple"
                allowClear
                placeholder="请选择已掌握的护理技能"
                optionFilterProp="label"
              >
                {registerRole === 'worker' && (
                  <Select.OptGroup label="专业护理（健康检查、医疗协助类）">
                    {PROFESSIONAL_SKILLS.map((skill) => (
                      <Option key={skill.code} value={skill.code} label={skill.label}>
                        {skill.label}
                      </Option>
                    ))}
                  </Select.OptGroup>
                )}
                <Select.OptGroup label="一般照护（陪诊、聊天、代购、日常陪伴）">
                  {GENERAL_SKILLS.map((skill) => (
                    <Option key={skill.code} value={skill.code} label={skill.label}>
                      {skill.label}
                    </Option>
                  ))}
                </Select.OptGroup>
              </Select>
            </Form.Item>
          )}

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              注册
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <Title level={2} className="!text-orange-600 !mb-2">
            社区老人关怀服务平台
          </Title>
          <Text type="secondary">让关爱更简单，让老人更幸福</Text>
        </div>

        <Card className="shadow-lg">
          <Tabs items={loginItems} centered />
        </Card>

        <div className="text-center mt-6">
          <Text type="secondary" className="text-sm">
            测试账号：child1 / 密码：123456（子女）
            <br />
            worker1 / 123456（护工）
          </Text>
        </div>
      </div>
    </div>
  );
};

export default Login;
