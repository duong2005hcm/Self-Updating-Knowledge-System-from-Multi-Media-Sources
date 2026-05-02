import os
import chromadb
from dotenv import load_dotenv

# Load biến môi trường
load_dotenv()

def initialize_chroma_client():
    # Kiểm tra biến môi trường
    api_key = os.getenv("CHROMA_CLOUD_API_KEY")
    tenant = os.getenv("CHROMA_TENANT_ID")
    database = os.getenv("CHROMA_DATABASE_NAME")
    
    if not api_key:
        raise ValueError("Thiếu biến môi trường: CHROMA_CLOUD_API_KEY")
    if not tenant:
        raise ValueError("Thiếu biến môi trường: CHROMA_TENANT_ID")
    if not database:
        raise ValueError("Thiếu biến môi trường: CHROMA_DATABASE")
    
    # Khởi tạo client
    try:
        client = chromadb.CloudClient(
            api_key=api_key,
            tenant=tenant,
            database=database
        )
        return client
    except Exception as e:
        raise Exception(f"Không thể kết nối đến ChromaDB Cloud: {str(e)}")


def test_connection():
    """Kiểm tra kết nối tới ChromaDB Cloud"""
    try:
        client = initialize_chroma_client()
        # Thử lấy danh sách collection để test kết nối
        collections = client.list_collections()
        print(f" Kết nối ChromaDB Cloud thành công!")
        print(f"   Số collection: {len(collections)}")
        return True
    except Exception as e:
        print(f" Kết nối ChromaDB Cloud thất bại: {e}")
        return False


def get_database_info():
    """Lấy thông tin cơ bản về database"""
    try:
        client = initialize_chroma_client()
        
        info = {
            "database_name": os.getenv("CHROMA_DATABASE"),
            "tenant": os.getenv("CHROMA_TENANT"),
            "collections_count": len(client.list_collections()),
            "collections": [col.name for col in client.list_collections()]
        }
        return info
    except Exception as e:
        return {
            "error": str(e),
            "database_name": os.getenv("CHROMA_DATABASE", "Not set"),
            "tenant": os.getenv("CHROMA_TENANT", "Not set")
        }


# Test nếu chạy trực tiếp file này
if __name__ == "__main__":
    print(" Testing ChromaDB connection...")
    if test_connection():
        print("\n Database info:")
        info = get_database_info()
        for key, value in info.items():
            print(f"   {key}: {value}")
    else:
        print("\n Không thể lấy thông tin database do kết nối thất bại.")