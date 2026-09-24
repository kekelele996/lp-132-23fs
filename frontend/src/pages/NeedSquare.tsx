import { useState, useEffect } from 'react';
import { Card, List, Tag, Button, Select, Input, Space, message, Modal, Rate, Form, Alert } from 'antd';
import { HeartOutlined, ClockCircleOutlined, EnvironmentOutlined, UserOutlined, StarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { careNeedsApi, favoriteApi, reviewApi } from '../services/api';
import { useAuthStore } from '../store/auth';
import { useNavigate } from 'react-router-dom';
import { skillLabel, isProfessionalSkill, parseSkillCodes } from '../constants/skills';

const { Search } = Input;
const { Option } = Select;
const { Meta } = Card;

const careTypeMap: Record<string, { label: string; color: string }> = {
  health_check: { label: '健康检查', color: 'blue' },
  medical_assist: { label: '医疗协助', color: 'red' },
  accompany: { label: '陪诊陪同', color: 'green' },
  daily_care: { label: '日常照料', color: 'orange' },
  shopping: { label: '代购代办', color: 'purple' },
  companionship: { label: '聊天陪伴', color: 'pink' },
  other: { label: '其他', color: 'default' },
};

// 志愿者可接单的服务类型：陪诊、聊天、代购、日常陪伴
const VOLUNTEER_ALLOWED_CARE_TYPES = ['accompany', 'shopping', 'companionship'];

interface SkillGap {
  code: string;
  label: string;
}

// 技能要求标签
const SkillTags = ({ codes, size }: { codes?: string[]; size?: 'small' }) => (
  <span className="flex flex-wrap gap-1">
    {(codes || []).map((code) => (
      <Tag
        key={code}
        color={isProfessionalSkill(code) ? 'red' : 'cyan'}
        style={size === 'small' ? { marginInlineEnd: 0 } : undefined}
      >
        {isProfessionalSkill(code) ? '专业 · ' : ''}{skillLabel(code)}
      </Tag>
    ))}
  </span>
);

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待接单', color: 'orange' },
  accepted: { label: '已接单', color: 'blue' },
  in_progress: { label: '进行中', color: 'processing' },
  completed: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'default' },
};

const NeedSquare = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [needs, setNeeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNeed, setSelectedNeed] = useState<any>(null);
  const [detailModal, setDetailModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewForm] = Form.useForm();
  const [favorites, setFavorites] = useState<any[]>([]);
  // 接单被拒时展示具体原因（缺少哪项能力 / 志愿者不可接）
  const [rejectInfo, setRejectInfo] = useState<{
    title: string;
    detail: string;
    gaps: SkillGap[];
  } | null>(null);

  const fetchNeeds = async (params?: any) => {
    setLoading(true);
    try {
      const response = await careNeedsApi.getList(params);
      setNeeds(response.data.needs);
    } catch (error) {
      message.error('获取需求列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchFavorites = async () => {
    if (user?.role === 'child') {
      try {
        const response = await favoriteApi.getList();
        setFavorites(response.data);
      } catch (error) {
        console.error('获取收藏列表失败', error);
      }
    }
  };

  useEffect(() => {
    fetchNeeds();
    fetchFavorites();
  }, []);

  const handleAccept = async (id: string) => {
    try {
      await careNeedsApi.accept(id);
      message.success('接单成功');
      fetchNeeds();
    } catch (error: any) {
      const data = error.response?.data;
      // 资格不符（技能不齐 / 志愿者接专业护理单）：弹出明确说明，订单仍保持待接单
      if (data?.code === 'SKILL_NOT_MATCH' || data?.code === 'PROFESSIONAL_CARE_NOT_ALLOWED') {
        const gaps: SkillGap[] =
          data.code === 'SKILL_NOT_MATCH'
            ? (data.missing_skills || [])
            : (data.professional_skills || []);
        setRejectInfo({
          title: data.code === 'SKILL_NOT_MATCH' ? '接单失败：护理技能不齐备' : '志愿者不能承接专业护理',
          detail: data.message || '接单失败',
          gaps,
        });
      } else {
        message.error(data?.message || '接单失败');
      }
    }
  };

  // 当前用户是否为志愿者
  const isVolunteer = user?.role === 'volunteer';

  // 志愿者不能接健康检查、医疗协助等专业护理单（服务类型或任一专业技能要求即拦截）
  const isProfessionalNeed = (need: any): boolean => {
    if (!VOLUNTEER_ALLOWED_CARE_TYPES.includes(need.care_type)) return true;
    return (need.required_skills || []).some((code: string) => isProfessionalSkill(code));
  };

  // 接单按钮：专业护理单对志愿者禁用并提示；其余情况点击后由后端逐项核对技能
  const acceptButton = (need: any, inModal = false) => {
    if (need.status !== 'pending') return null;
    if (user?.role !== 'worker' && user?.role !== 'volunteer') return null;
    if (isVolunteer && isProfessionalNeed(need)) {
      return (
        <Button
          size={inModal ? 'middle' : 'small'}
          disabled
          title="志愿者只参与陪诊、聊天、代购和日常陪伴，不承接健康检查、医疗协助等专业护理"
        >
          仅专业护工可接
        </Button>
      );
    }
    return (
      <Button
        type="primary"
        size={inModal ? 'middle' : 'small'}
        onClick={(e) => { e.stopPropagation(); handleAccept(need.id); }}
      >
        接单
      </Button>
    );
  };

  const handleStart = async (id: string) => {
    try {
      await careNeedsApi.start(id);
      message.success('服务已开始');
      fetchNeeds();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await careNeedsApi.complete(id);
      message.success('服务已完成');
      fetchNeeds();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleCancel = async (id: string) => {
    Modal.confirm({
      title: '确认取消',
      content: '确定要取消这个订单吗？',
      onOk: async () => {
        try {
          await careNeedsApi.cancel(id);
          message.success('已取消');
          fetchNeeds();
        } catch (error: any) {
          message.error(error.response?.data?.message || '取消失败');
        }
      },
    });
  };

  const handleFavorite = async (workerId: string) => {
    try {
      const isFavorited = favorites.some((f) => f.worker_id === workerId);
      if (isFavorited) {
        await favoriteApi.remove(workerId);
        message.success('已取消收藏');
      } else {
        await favoriteApi.add(workerId);
        message.success('收藏成功');
      }
      fetchFavorites();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleReview = async (values: any) => {
    try {
      await reviewApi.create({
        ...values,
        order_id: selectedNeed.id,
        reviewee_id: user?.role === 'child' ? selectedNeed.worker_id : selectedNeed.child_id,
      });
      message.success('评价成功');
      setReviewModal(false);
      reviewForm.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.message || '评价失败');
    }
  };

  const openDetail = (need: any) => {
    setSelectedNeed(need);
    setDetailModal(true);
  };

  const openReview = (need: any) => {
    setSelectedNeed(need);
    setReviewModal(true);
  };

  const handleChat = (userId: string) => {
    navigate('/messages', { state: { userId } });
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">需求广场</h1>
        <Space>
          <Select
            placeholder="服务类型"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => fetchNeeds({ care_type: value })}
          >
            <Option value="health_check">健康检查</Option>
            <Option value="medical_assist">医疗协助</Option>
            <Option value="accompany">陪诊陪同</Option>
            <Option value="daily_care">日常照料</Option>
            <Option value="shopping">代购代办</Option>
            <Option value="companionship">聊天陪伴</Option>
            <Option value="other">其他</Option>
          </Select>
          <Select
            placeholder="订单状态"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => fetchNeeds({ status: value })}
          >
            <Option value="pending">待接单</Option>
            <Option value="accepted">已接单</Option>
            <Option value="in_progress">进行中</Option>
            <Option value="completed">已完成</Option>
            <Option value="cancelled">已取消</Option>
          </Select>
          <Search
            placeholder="搜索需求"
            style={{ width: 250 }}
            onSearch={(value) => fetchNeeds({ keyword: value })}
            allowClear
          />
        </Space>
      </div>

      <List
        grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 4 }}
        dataSource={needs}
        loading={loading}
        renderItem={(item) => (
          <List.Item>
            <Card
              hoverable
              onClick={() => openDetail(item)}
              className="h-full"
              actions={[
                acceptButton(item),
                item.status === 'accepted' && item.worker_id === user?.id ? (
                  <Button type="primary" size="small" onClick={(e) => { e.stopPropagation(); handleStart(item.id); }}>
                    开始服务
                  </Button>
                ) : null,
                item.status === 'in_progress' && item.worker_id === user?.id ? (
                  <Button type="primary" size="small" onClick={(e) => { e.stopPropagation(); handleComplete(item.id); }}>
                    完成服务
                  </Button>
                ) : null,
                item.status === 'completed' && (item.child_id === user?.id || item.worker_id === user?.id) ? (
                  <Button size="small" onClick={(e) => { e.stopPropagation(); openReview(item); }}>
                    评价
                  </Button>
                ) : null,
                (item.status === 'pending' || item.status === 'accepted') && item.child_id === user?.id ? (
                  <Button danger size="small" onClick={(e) => { e.stopPropagation(); handleCancel(item.id); }}>
                    取消
                  </Button>
                ) : null,
              ].filter(Boolean)}
            >
              <Meta
                title={
                  <div className="flex justify-between items-center">
                    <span className="truncate">{item.title}</span>
                    <Tag color={statusMap[item.status]?.color}>
                      {statusMap[item.status]?.label}
                    </Tag>
                  </div>
                }
                description={
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center text-gray-600">
                      <Tag color={careTypeMap[item.care_type]?.color}>
                        {careTypeMap[item.care_type]?.label}
                      </Tag>
                      <span className="ml-2 text-orange-500 font-medium">
                        ¥{item.price}
                      </span>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs mb-1">技能要求：</div>
                      <SkillTags codes={item.required_skills} size="small" />
                    </div>
                    {isVolunteer && isProfessionalNeed(item) && (
                      <div className="text-red-500 text-xs">
                        含健康检查/医疗协助等专业护理，志愿者不可接
                      </div>
                    )}
                    <div className="flex items-center text-gray-500 text-sm">
                      <ClockCircleOutlined className="mr-1" />
                      {dayjs(item.start_time).format('YYYY-MM-DD HH:mm')}
                    </div>
                    <div className="flex items-center text-gray-500 text-sm">
                      <EnvironmentOutlined className="mr-1" />
                      <span className="truncate">{item.address}</span>
                    </div>
                    <div className="flex items-center text-gray-500 text-sm">
                      <UserOutlined className="mr-1" />
                      {item.elderly_name} ({item.elderly_age}岁)
                    </div>
                    {item.worker_name && (
                      <div className="flex items-center text-gray-500 text-sm">
                        <HeartOutlined className="mr-1" />
                        护工：{item.worker_name}
                      </div>
                    )}
                  </div>
                }
              />
            </Card>
          </List.Item>
        )}
      />

      <Modal
        title="需求详情"
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={null}
        width={600}
      >
        {selectedNeed && (
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold">{selectedNeed.title}</h2>
              <Tag color={statusMap[selectedNeed.status]?.color}>
                {statusMap[selectedNeed.status]?.label}
              </Tag>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="flex">
                <span className="w-24 text-gray-500">服务类型：</span>
                <Tag color={careTypeMap[selectedNeed.care_type]?.color}>
                  {careTypeMap[selectedNeed.care_type]?.label}
                </Tag>
              </div>
              <div className="flex">
                <span className="w-24 shrink-0 text-gray-500">技能要求：</span>
                <div>
                  <SkillTags codes={selectedNeed.required_skills} />
                  <p className="text-xs text-gray-400 mt-1">
                    接单时系统逐项核对，全部具备才可接单；红色标签为专业护理技能，仅专业护工可接
                  </p>
                </div>
              </div>
              {isVolunteer && isProfessionalNeed(selectedNeed) && (
                <Alert
                  type="warning"
                  showIcon
                  message="本单含健康检查、医疗协助等专业护理内容，志愿者不能接单。志愿者可参与陪诊、聊天、代购和日常陪伴。"
                />
              )}
              {!isVolunteer && user?.role === 'worker' && (() => {
                const mySkills = new Set(parseSkillCodes(user?.skills));
                const gaps = (selectedNeed.required_skills || []).filter((c: string) => !mySkills.has(c));
                if (gaps.length === 0) return null;
                return (
                  <Alert
                    type="error"
                    showIcon
                    message={`您当前缺少本单要求的技能：${gaps.map((c: string) => skillLabel(c)).join('、')}，请先在个人中心补充技能后再接单`}
                  />
                );
              })()}
              <div className="flex">
                <span className="w-24 text-gray-500">服务价格：</span>
                <span className="text-orange-500 font-medium text-lg">¥{selectedNeed.price}</span>
              </div>
              <div className="flex">
                <span className="w-24 text-gray-500">服务时间：</span>
                <span>{dayjs(selectedNeed.start_time).format('YYYY-MM-DD HH:mm')}</span>
              </div>
              <div className="flex">
                <span className="w-24 text-gray-500">服务时长：</span>
                <span>{selectedNeed.duration_hours}小时</span>
              </div>
              <div className="flex">
                <span className="w-24 text-gray-500">服务地址：</span>
                <span>{selectedNeed.address}</span>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">服务内容</h3>
              <p className="text-gray-700">{selectedNeed.description}</p>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">老人信息</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>姓名：{selectedNeed.elderly_name}</div>
                <div>年龄：{selectedNeed.elderly_age}岁</div>
                <div>性别：{selectedNeed.elderly_gender}</div>
                <div>病史：{selectedNeed.medical_history || '无'}</div>
                <div>用药：{selectedNeed.medication || '无'}</div>
                <div>紧急联系人：{selectedNeed.emergency_contact} ({selectedNeed.emergency_phone})</div>
              </div>
            </div>

            {selectedNeed.worker_name && (
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">接单护工：{selectedNeed.worker_name}</h3>
                    <p className="text-sm text-gray-500">联系电话：{selectedNeed.worker_phone}</p>
                  </div>
                  {user?.role === 'child' && (
                    <Space>
                      <Button
                        icon={favorites.some((f) => f.worker_id === selectedNeed.worker_id) ? <StarOutlined style={{ color: '#fadb14' }} /> : <StarOutlined />}
                        onClick={() => handleFavorite(selectedNeed.worker_id)}
                      >
                        {favorites.some((f) => f.worker_id === selectedNeed.worker_id) ? '已收藏' : '收藏'}
                      </Button>
                      <Button type="primary" onClick={() => handleChat(selectedNeed.worker_id)}>
                        联系护工
                      </Button>
                    </Space>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              {selectedNeed.status === 'pending' && (user?.role === 'worker' || user?.role === 'volunteer') && (
                acceptButton(selectedNeed, true)
              )}
              {selectedNeed.status === 'accepted' && selectedNeed.worker_id === user?.id && (
                <Button type="primary" onClick={() => handleStart(selectedNeed.id)}>
                  开始服务
                </Button>
              )}
              {selectedNeed.status === 'in_progress' && selectedNeed.worker_id === user?.id && (
                <Button type="primary" onClick={() => handleComplete(selectedNeed.id)}>
                  完成服务
                </Button>
              )}
              {selectedNeed.status === 'completed' && (selectedNeed.child_id === user?.id || selectedNeed.worker_id === user?.id) && (
                <Button onClick={() => openReview(selectedNeed)}>
                  评价
                </Button>
              )}
              {(selectedNeed.status === 'pending' || selectedNeed.status === 'accepted') && selectedNeed.child_id === user?.id && (
                <Button danger onClick={() => handleCancel(selectedNeed.id)}>
                  取消订单
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="服务评价"
        open={reviewModal}
        onCancel={() => setReviewModal(false)}
        footer={null}
      >
        <Form form={reviewForm} onFinish={handleReview} layout="vertical">
          <Form.Item
            name="rating"
            label="评分"
            rules={[{ required: true, message: '请选择评分' }]}
          >
            <Rate />
          </Form.Item>
          <Form.Item name="comment" label="评价内容">
            <Input.TextArea rows={4} placeholder="请输入您的评价..." />
          </Form.Item>
          <Form.Item className="mb-0">
            <div className="flex justify-end space-x-3">
              <Button onClick={() => setReviewModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交评价</Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={rejectInfo?.title}
        open={!!rejectInfo}
        onCancel={() => setRejectInfo(null)}
        footer={<Button type="primary" onClick={() => setRejectInfo(null)}>我知道了</Button>}
      >
        <Alert type="error" showIcon message={rejectInfo?.detail} />
        {rejectInfo && rejectInfo.gaps.length > 0 && (
          <div className="mt-4">
            <div className="text-gray-600 mb-2">缺少/不可承接的能力：</div>
            <Space wrap>
              {rejectInfo.gaps.map((gap) => (
                <Tag key={gap.code} color="red">
                  {gap.label}
                </Tag>
              ))}
            </Space>
            <p className="text-gray-400 text-sm mt-3">
              订单未被占用，仍保持“待接单”，请具备相应能力的服务者接单。
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default NeedSquare;
