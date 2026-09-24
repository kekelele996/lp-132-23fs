import { useState, useEffect } from 'react';
import { Card, Form, Input, Select, DatePicker, InputNumber, Button, message, Row, Col, Alert, Tag } from 'antd';import { elderlyApi, careNeedsApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  careSkills,
  careTypes,
  defaultSkillsByCareType,
  isVolunteerCareType,
  skillLabel,
} from '../constants/careSkills';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const professionalSkills = careSkills.filter((skill) => skill.professional);
const generalSkills = careSkills.filter((skill) => !skill.professional);

const PublishNeed = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [elderlyList, setElderlyList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const careType = Form.useWatch('care_type', form);
  const selectedSkills: string[] = Form.useWatch('required_skills', form) ?? [];

  useEffect(() => {
    const fetchElderly = async () => {
      try {
        const response = await elderlyApi.getList();
        setElderlyList(response.data);
      } catch (error) {
        message.error('获取老人列表失败');
      }
    };
    fetchElderly();
  }, []);

  const handleCareTypeChange = (value: string) => {
    // 根据服务类型默认勾上建议技能，家属仍可自行增删
    const suggested = defaultSkillsByCareType[value] ?? [];
    form.setFieldValue('required_skills', suggested);
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const [start_time, end_time] = values.time_range;
      const duration_hours = end_time.diff(start_time, 'hour', true);

      await careNeedsApi.create({
        ...values,
        required_skills: values.required_skills ?? [],
        start_time: start_time.toISOString(),
        end_time: end_time.toISOString(),
        duration_hours: duration_hours.toFixed(2),
      });

      message.success('发布成功');
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.message || '发布失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">发布照护需求</h1>

      <Card className="max-w-3xl mx-auto">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            price: 80,
            duration_hours: 1,
            required_skills: [],
          }}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="elderly_id"
                label="选择老人"
                rules={[{ required: true, message: '请选择服务对象' }]}
              >
                <Select placeholder="请选择要服务的老人">
                  {elderlyList.map((elderly) => (
                    <Option key={elderly.id} value={elderly.id}>
                      {elderly.name} ({elderly.gender}，{elderly.age}岁)
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="title"
                label="需求标题"
                rules={[{ required: true, message: '请输入需求标题' }]}
              >
                <Input placeholder="例如：上门量血压、陪同就医等" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="care_type"
                label="服务类型"
                rules={[{ required: true, message: '请选择服务类型' }]}
              >
                <Select placeholder="请选择服务类型" onChange={handleCareTypeChange}>
                  {careTypes.map((type) => (
                    <Option key={type.value} value={type.value}>
                      {type.label}
                      {type.volunteerAllowed ? '' : '（需专业护工）'}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="required_skills"
            label="护理技能要求"
            extra="从护理技能中勾选本单必须具备的能力，接单时会逐项核对，不满足的护工/志愿者无法接单"
            rules={[{ required: true, message: '请至少选择一项护理技能要求' }]}
          >
            <Select
              mode="multiple"
              placeholder="例如：血压测量、注射打针、陪诊等"
              optionFilterProp="children"
              allowClear
            >
              <Select.OptGroup label="专业护理技能（仅护工可接）">
                {professionalSkills.map((skill) => (
                  <Option key={skill.value} value={skill.value}>
                    {skill.label}
                  </Option>
                ))}
              </Select.OptGroup>
              <Select.OptGroup label="陪伴与生活协助（志愿者可参与）">
                {generalSkills.map((skill) => (
                  <Option key={skill.value} value={skill.value}>
                    {skill.label}
                  </Option>
                ))}
              </Select.OptGroup>
            </Select>
          </Form.Item>

          {careType && (
            <Alert
              className="mb-4"
              type={isVolunteerCareType(careType) ? 'info' : 'warning'}
              showIcon
              message={
                isVolunteerCareType(careType)
                  ? '该服务类型志愿者也可参与，具备所选技能的志愿者可以接单'
                  : '该服务属于专业护理，仅护工可接单，志愿者无法抢单'
              }
              description={
                <div className="mt-1">
                  当前技能要求：
                  {selectedSkills.length === 0 ? (
                    <span className="text-gray-500">暂未选择</span>
                  ) : (
                    selectedSkills.map((skill) => (
                      <Tag key={skill} color="blue" className="mb-1">
                        {skillLabel(skill)}
                      </Tag>
                    ))
                  )}
                </div>
              }
            />
          )}

          <Form.Item
            name="description"
            label="服务描述"
            rules={[{ required: true, message: '请输入服务描述' }]}
          >
            <TextArea
              rows={4}
              placeholder="请详细描述您的需求，包括服务内容、注意事项等"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="time_range"
                label="服务时间"
                rules={[{ required: true, message: '请选择服务时间' }]}
              >
                <RangePicker
                  showTime
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD HH:mm"
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="price"
                label="服务价格(元)"
                rules={[{ required: true, message: '请输入服务价格' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={10}
                  placeholder="请输入价格"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="address"
            label="服务地址"
            rules={[{ required: true, message: '请输入服务地址' }]}
          >
            <Input placeholder="请输入详细的服务地址" />
          </Form.Item>

          <Form.Item className="mb-0">
            <div className="flex justify-end space-x-3">
              <Button onClick={() => navigate('/')}>取消</Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                发布需求
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default PublishNeed;
