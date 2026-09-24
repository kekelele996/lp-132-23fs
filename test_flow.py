#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
养老陪护平台 - 完整业务流程测试脚本

运行依赖:
- Python 3.7+
- requests 库 (安装: pip install requests)

运行前确保:
1. Docker 服务已启动
2. 项目容器已运行 (docker compose up -d)
3. 后端服务在 http://localhost:3232 可访问

测试流程:
1. child1 (家属) 登录
2. 查询 child1 的老人档案列表，获取第一个老人 ID
3. child1 发布带技能要求的护理需求（日常照料）
4. 技能核对：
   - volunteer1 (志愿者) 抢专业护理单会被拒绝（志愿者仅可陪诊/代购/聊天/陪伴）
   - 缺少所需技能的护工抢单会被拒绝，返回缺少的具体技能
5. worker1 (护工，具备要求技能) 接单
6. worker1 开始服务
7. worker1 完成服务
8. child1 评价服务
"""

import requests
import json
import base64
import time

BASE_URL = "http://localhost:3232/api"


def login(username, password):
    """用户登录，返回用户信息字典"""
    url = f"{BASE_URL}/auth/login"
    data = {"username": username, "password": password}
    response = requests.post(url, json=data)
    result = response.json()
    if "token" in result:
        token = result["token"]
        payload = json.loads(base64.b64decode(token.split('.')[1] + '=='))
        user_info = {
            "token": token,
            "id": payload["id"],
            "role": payload["role"],
            "username": payload["username"]
        }
        print(f"✓ {username} 登录成功, ID: {user_info['id']}")
        return user_info
    else:
        print(f"✗ {username} 登录失败: {result}")
        return None


def get_headers(token):
    """构造请求头"""
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def get_elderly_profiles(token):
    """查询用户的老人档案列表"""
    url = f"{BASE_URL}/elderly"
    response = requests.get(url, headers=get_headers(token))
    result = response.json()
    if isinstance(result, list):
        print(f"✓ 查询到 {len(result)} 条老人档案")
        for idx, elderly in enumerate(result):
            print(f"  [{idx}] {elderly.get('name', '未知')} (ID: {elderly.get('id')})")
        return result
    else:
        print(f"✗ 查询老人档案失败: {result}")
        return []


def create_care_need(token, elderly_id):
    """发布护理需求（带技能要求）"""
    url = f"{BASE_URL}/care-needs"
    data = {
        "elderly_id": elderly_id,
        "title": "日常护理需求",
        "description": "需要专业护工进行日常照料，包括帮助穿衣、洗漱、做饭等",
        "care_type": "daily_care",
        "required_skills": ["daily_care"],
        "start_time": "2025-06-18 09:00:00",
        "address": "北京市朝阳区某某小区1号楼"
    }
    response = requests.post(url, headers=get_headers(token), json=data)
    result = response.json()
    if "need" in result:
        need_id = result["need"]["id"]
        skills = result["need"].get("required_skills", "")
        print(f"✓ 发布需求成功，需求ID: {need_id}，技能要求: {skills}")
        return need_id
    else:
        print(f"✗ 发布需求失败: {result}")
        return None


def create_health_check_need(token, elderly_id):
    """发布带「血压测量」技能要求的健康检查需求"""
    url = f"{BASE_URL}/care-needs"
    data = {
        "elderly_id": elderly_id,
        "title": "上门量血压",
        "description": "上门为老人测量血压并记录数据",
        "care_type": "health_check",
        "required_skills": ["blood_pressure"],
        "start_time": "2025-06-19 09:00:00",
        "address": "北京市朝阳区某某小区1号楼"
    }
    response = requests.post(url, headers=get_headers(token), json=data)
    result = response.json()
    if "need" in result:
        need_id = result["need"]["id"]
        print(f"✓ 发布健康检查需求成功，需求ID: {need_id}，技能要求: {result['need'].get('required_skills')}")
        return need_id
    print(f"✗ 发布健康检查需求失败: {result}")
    return None


def accept_order_expect_fail(token, need_id, label):
    """接单应被拒绝，返回 (是否正确拒绝, 后端说明)"""
    url = f"{BASE_URL}/care-needs/{need_id}/accept"
    response = requests.post(url, headers=get_headers(token))
    result = response.json()
    if response.status_code in (400, 403) and "need" not in result:
        print(f"✓ {label} 已被正确拒绝：{result.get('message')}")
        return True
    print(f"✗ {label} 本应被拒绝，却成功了: {result}")
    return False


def accept_order(token, need_id):
    """护工接单"""
    url = f"{BASE_URL}/care-needs/{need_id}/accept"
    response = requests.post(url, headers=get_headers(token))
    result = response.json()
    if "need" in result:
        print(f"✓ 接单成功，需求ID: {need_id}")
        return True
    else:
        print(f"✗ 接单失败: {result}")
        return False


def start_service(token, need_id):
    """开始服务"""
    url = f"{BASE_URL}/care-needs/{need_id}/start"
    response = requests.post(url, headers=get_headers(token))
    result = response.json()
    if "need" in result:
        print(f"✓ 开始服务成功，需求ID: {need_id}")
        return True
    else:
        print(f"✗ 开始服务失败: {result}")
        return False


def complete_service(token, need_id):
    """完成服务"""
    url = f"{BASE_URL}/care-needs/{need_id}/complete"
    response = requests.post(url, headers=get_headers(token))
    result = response.json()
    if "need" in result:
        print(f"✓ 完成服务成功，需求ID: {need_id}")
        return True
    else:
        print(f"✗ 完成服务失败: {result}")
        return False


def create_review(token, need_id, worker_id):
    """评价服务"""
    url = f"{BASE_URL}/reviews"
    data = {
        "order_id": need_id,
        "reviewee_id": worker_id,
        "rating": 5,
        "comment": "服务非常好，护工很专业也很有耐心"
    }
    response = requests.post(url, headers=get_headers(token), json=data)
    result = response.json()
    if "review" in result:
        print(f"✓ 评价成功，评价ID: {result['review']['id']}")
        return True
    else:
        print(f"✗ 评价失败: {result}")
        return False


def main():
    print("=" * 60)
    print("养老陪护平台 - 完整业务流程测试")
    print("=" * 60)

    print("\n" + "-" * 60)
    print("步骤0: 用户登录")
    print("-" * 60)

    child1 = login("child1", "123456")
    if not child1:
        return

    worker1 = login("worker1", "123456")
    if not worker1:
        return

    volunteer1 = login("volunteer1", "123456")
    if not volunteer1:
        return

    worker2 = login("worker2", "123456")
    if not worker2:
        return

    print("\n" + "-" * 60)
    print("步骤1: 查询 child1 的老人档案")
    print("-" * 60)

    elderly_list = get_elderly_profiles(child1["token"])
    if not elderly_list:
        print("✗ 没有可用的老人档案，无法继续测试")
        return

    elderly_id = elderly_list[0]["id"]
    elderly_name = elderly_list[0].get("name", "未知")
    print(f"  使用老人档案: {elderly_name} (ID: {elderly_id})")

    print("\n" + "-" * 60)
    print("步骤2: child1 发布带技能要求的专业护理需求")
    print("-" * 60)

    need_id = create_care_need(child1["token"], elderly_id)
    if not need_id:
        return

    time.sleep(1)

    print("\n" + "-" * 60)
    print("步骤3: 接单资格核对（志愿者 / 技能不符的护工应被拒绝，订单不被占用）")
    print("-" * 60)

    # 志愿者不能接日常照料（专业护理），只能参与陪诊、代购、聊天、日常陪伴
    if not accept_order_expect_fail(volunteer1["token"], need_id, "志愿者接专业护理单"):
        return

    # worker2 的技能是康复训练/日常照料，与 worker1 区分：这里发布一个量血压需求，
    # worker2 缺少血压测量技能，应当被明确拒绝并说明缺少哪项能力
    health_need_id = create_health_check_need(child1["token"], elderly_id)
    if not health_need_id:
        return

    if not accept_order_expect_fail(volunteer1["token"], health_need_id, "志愿者接健康检查单"):
        return

    if not accept_order_expect_fail(worker2["token"], health_need_id, "缺少血压测量技能的护工抢单"):
        return

    print("\n" + "-" * 60)
    print("步骤4: worker1 接专业护理需求")
    print("-" * 60)

    if not accept_order(worker1["token"], need_id):
        return

    time.sleep(1)

    print("\n" + "-" * 60)
    print("步骤5: worker1 开始服务")
    print("-" * 60)

    if not start_service(worker1["token"], need_id):
        return

    time.sleep(1)

    print("\n" + "-" * 60)
    print("步骤6: worker1 完成服务")
    print("-" * 60)

    if not complete_service(worker1["token"], need_id):
        return

    time.sleep(1)

    print("\n" + "-" * 60)
    print("步骤7: child1 评价服务")
    print("-" * 60)

    if not create_review(child1["token"], need_id, worker1["id"]):
        return

    print("\n" + "=" * 60)
    print("✓ 整个业务流程测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
