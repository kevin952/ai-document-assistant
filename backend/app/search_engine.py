from langchain_openai import OpenAIEmbeddings
from langchain_openai import ChatOpenAI
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_anthropic import ChatAnthropic
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
import os
from dotenv import load_dotenv
import logging

load_dotenv()

logger = logging.getLogger(__name__)

class SearchEngine:
    def __init__(self):
        self.embeddings = OpenAIEmbeddings(
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        self.vectorstore_dir = "data/vectorstore"
        os.makedirs(self.vectorstore_dir, exist_ok=True)
        self.vectorstore = Chroma(
            persist_directory=self.vectorstore_dir,
            embedding_function=self.embeddings,
            collection_name="company_documents"
        )
        self.llm = ChatOpenAI(
            model="gpt-4-turbo-preview",
            temperature=0.7,
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Define model configurations
        self.model_configs = {
            "gpt-4": {
                "provider": "openai",
                "model": ChatOpenAI(
                    model_name="gpt-4",
                    openai_api_key=os.getenv("OPENAI_API_KEY")
                )
            },
            "gpt-4-turbo": {
                "provider": "openai",
                "model": ChatOpenAI(
                    model_name="gpt-4-turbo-preview",
                    openai_api_key=os.getenv("OPENAI_API_KEY")
                )
            },
            "gpt-3.5-turbo": {
                "provider": "openai",
                "model": ChatOpenAI(
                    model_name="gpt-3.5-turbo",
                    openai_api_key=os.getenv("OPENAI_API_KEY")
                )
            },
            "claude-3-opus": {
                "provider": "anthropic",
                "model": ChatAnthropic(
                    model="claude-3-opus-20240229",
                    anthropic_api_key=os.getenv("ANTHROPIC_API_KEY")
                )
            },
            "claude-3-sonnet": {
                "provider": "anthropic",
                "model": ChatAnthropic(
                    model="claude-3-sonnet-20240229",
                    anthropic_api_key=os.getenv("ANTHROPIC_API_KEY")
                )
            },
            "claude-2.1": {
                "provider": "anthropic",
                "model": ChatAnthropic(
                    model="claude-2.1",
                    anthropic_api_key=os.getenv("ANTHROPIC_API_KEY")
                )
            }
        }

    def search(self, query: str, model: str = "gpt-4") -> str:
        try:
            # Search for relevant documents
            results = self.vectorstore.similarity_search_with_score(query, k=5)
            
            # Extract sources
            sources = list(set([doc.metadata.get("source", "Unknown") for doc, _ in results]))
            
            # Create the prompt template
            prompt = PromptTemplate(
                template="""You are a knowledgeable expert on the company's products and services. Your task is to provide accurate, well-structured information based on the provided context.

Context:
{context}

Question: {query}

Guidelines:
1. Focus on the specific aspect asked in the question (hardware, subproduct, or main product)
2. Provide relevant context from the product hierarchy
3. Include technical details when applicable
4. Explain functionality and integration points
5. Share best practices when relevant

Format your response with the following sections:

Answer
[Provide a clear, concise answer to the question]

Context
[Include relevant product hierarchy information]

Technical Details
[Include specific technical information]

Functionality
[Explain how it works]

Integration
[Describe integration points]

Best Practices
[Share relevant best practices]

References
[List the source documents used]

Important:
- Start directly with the Answer section
- Do not include any introductory text about sources or context
- Use clear, professional language without markdown
- Focus on providing specific, actionable information
- Include only information from the provided context""",
                input_variables=["context", "query"]
            )
            
            # Create chain with memory for better context
            chain = (
                {"context": RunnablePassthrough(), "query": RunnablePassthrough()}
                | prompt
                | self.llm
                | StrOutputParser()
            )
            
            # Combine context from all relevant documents with better organization
            context = "\n\n".join([
                f"Document: {doc.metadata.get('source', 'Unknown')}\n{doc.page_content}"
                for doc, _ in results
            ])
            
            # Generate response
            response = chain.invoke({"context": context, "query": query})
            
            # Add sources in a cleaner format
            response += "\n\nReferences:\n" + "\n".join([f"- {source}" for source in sources])
            
            return response
            
        except Exception as e:
            logger.error(f"Error in search: {str(e)}")
            raise 